import crypto from "node:crypto";
import { createOAuthState } from "../../git-integration/oauthState";
import {
  buildGithubAppManifest,
  evaluateGithubAppPermissions,
  githubAppPermissionsSummary,
  GITHUB_APP_EVENTS,
} from "./githubAppPermissions";

export {
  evaluateGithubAppPermissions,
  githubAppPermissionsSummary,
  GITHUB_APP_REPOSITORY_PERMISSIONS,
} from "./githubAppPermissions";
export type { GithubAppPermissionCheck } from "./githubAppPermissions";

const API_BASE = "https://api.github.com";

function appConfig() {
  const appId = process.env.GITHUB_APP_ID?.trim();
  const privateKey = normalizePrivateKey(process.env.GITHUB_APP_PRIVATE_KEY);
  const appSlug = process.env.GITHUB_APP_SLUG?.trim();
  if (!appId || !privateKey) return null;
  return { appId, privateKey, appSlug };
}

export function isGithubAppConfigured(): boolean {
  return appConfig() !== null;
}

function normalizePrivateKey(raw?: string): string | null {
  if (!raw?.trim()) return null;
  let key = raw.trim().replace(/^["']|["']$/g, "");
  if (key.includes("\\n")) {
    key = key.replace(/\\n/g, "\n");
  }
  key = key.trim();
  if (!key.includes("BEGIN")) {
    const body = key.replace(/\s+/g, "");
    const lines = body.match(/.{1,64}/g) ?? [body];
    key = `-----BEGIN RSA PRIVATE KEY-----\n${lines.join("\n")}\n-----END RSA PRIVATE KEY-----`;
  }
  return key;
}

export function createAppJwt(): string {
  const config = appConfig();
  if (!config) throw new Error("GitHub App is not configured on the server");

  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString(
    "base64url"
  );
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({ iat: now - 60, exp: now + 9 * 60, iss: config.appId })
  ).toString("base64url");
  const unsigned = `${header}.${payload}`;
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(unsigned)
    .sign(config.privateKey, "base64url");
  return `${unsigned}.${signature}`;
}

async function appFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const jwt = createAppJwt();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${jwt}`,
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub App API ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as T;
}

export type GithubInstallationMeta = {
  id: number;
  account: { login: string; type: string };
  targetType?: string;
  permissions?: Record<string, string>;
  events?: string[];
  suspendedAt?: string | null;
};

export async function getInstallation(
  installationId: string
): Promise<GithubInstallationMeta> {
  return appFetch<GithubInstallationMeta>(
    `/app/installations/${encodeURIComponent(installationId)}`
  );
}

export async function getInstallationAccessToken(
  installationId: string
): Promise<string> {
  const data = await appFetch<{ token: string }>(
    `/app/installations/${encodeURIComponent(installationId)}/access_tokens`,
    { method: "POST" }
  );
  return data.token;
}

/** True when GitHub no longer has this installation (uninstalled app or wrong GITHUB_APP_ID). */
export function isGithubInstallationMissingError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return (
    err.message.includes("GitHub App API 404") &&
    err.message.includes("/app/installations/")
  );
}

export type InstallationRepo = {
  id: number;
  fullName: string;
  owner: string;
  name: string;
  defaultBranch: string;
  private: boolean;
};

export async function listInstallationRepositories(
  installationId: string
): Promise<InstallationRepo[]> {
  const token = await getInstallationAccessToken(installationId);
  const res = await fetch(`${API_BASE}/installation/repositories?per_page=100`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub installation repos ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    repositories: Array<{
      id: number;
      full_name: string;
      name: string;
      private: boolean;
      default_branch?: string;
      owner: { login: string };
    }>;
  };
  return data.repositories.map((repo) => ({
    id: repo.id,
    fullName: repo.full_name,
    owner: repo.owner.login,
    name: repo.name,
    defaultBranch: repo.default_branch ?? "main",
    private: repo.private,
  }));
}

export function githubAppInstallUrl(state?: string): string | null {
  const config = appConfig();
  if (!config?.appSlug) return null;
  const oauthState = state ?? createOAuthState();
  const params = new URLSearchParams({ state: oauthState });
  return `https://github.com/apps/${config.appSlug}/installations/new?${params.toString()}`;
}

export type AppInstallationSummary = {
  id: number;
  accountLogin: string;
  accountType: string;
  repositorySelection: string;
};

/** Lists installations of this GitHub App (JWT auth). */
export async function listAppInstallations(): Promise<AppInstallationSummary[]> {
  const data = await appFetch<
    | Array<{
        id: number;
        repository_selection: string;
        account: { login: string; type: string };
      }>
    | {
        installations: Array<{
          id: number;
          repository_selection: string;
          account: { login: string; type: string };
        }>;
      }
  >("/app/installations?per_page=100");
  const rows = Array.isArray(data) ? data : (data.installations ?? []);
  return rows.map((row) => ({
    id: row.id,
    accountLogin: row.account.login,
    accountType: row.account.type,
    repositorySelection: row.repository_selection,
  }));
}

/** Verifies JWT + private key by calling GET /app (no installation required). */
export async function probeGithubAppCredentials(): Promise<{
  ok: boolean;
  appName?: string;
  error?: string;
}> {
  try {
    const data = await appFetch<{ name?: string; slug?: string }>("/app");
    return { ok: true, appName: data.name ?? data.slug ?? "github-app" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "github_app_probe_failed",
    };
  }
}

export function githubAppPublicConfig() {
  const config = appConfig();
  return {
    configured: Boolean(config),
    appSlug: config?.appSlug ?? null,
    permissions: githubAppPermissionsSummary(),
    events: [...GITHUB_APP_EVENTS],
    capabilities: [
      "Codebase index & visualization",
      "Semantic search & Ask",
      "Branch push & pull requests",
      "QA sandbox clone",
    ],
    permissionsFixUrl: config?.appSlug
      ? `https://github.com/settings/apps/${encodeURIComponent(config.appSlug)}/permissions`
      : null,
  };
}

export async function checkInstallationPermissions(
  installationId: string
): Promise<ReturnType<typeof evaluateGithubAppPermissions>> {
  const config = appConfig();
  const meta = await getInstallation(installationId);
  return evaluateGithubAppPermissions(meta.permissions, config?.appSlug ?? null);
}

/** Build GitHub manifest URL to register a new app with correct permissions. */
export function githubAppManifestCreateUrl(input: {
  webhookUrl: string;
  setupUrl: string;
  callbackUrl: string;
  appUrl?: string;
}): string | null {
  const config = appConfig();
  if (!config?.appSlug) return null;

  const manifest = buildGithubAppManifest({
    name: "AgentOS",
    url: input.appUrl ?? input.setupUrl,
    webhookUrl: input.webhookUrl,
    setupUrl: input.setupUrl,
    callbackUrl: input.callbackUrl,
  });

  const params = new URLSearchParams({
    state: createOAuthState(),
  });
  return `https://github.com/settings/apps/new?manifest=${encodeURIComponent(JSON.stringify(manifest))}&${params.toString()}`;
}
