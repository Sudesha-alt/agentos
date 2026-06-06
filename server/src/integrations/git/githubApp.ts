import crypto from "node:crypto";

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
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
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

export async function getInstallationAccessToken(
  installationId: string
): Promise<string> {
  const data = await appFetch<{ token: string }>(
    `/app/installations/${encodeURIComponent(installationId)}/access_tokens`,
    { method: "POST" }
  );
  return data.token;
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

export function githubAppInstallUrl(): string | null {
  const config = appConfig();
  if (!config?.appSlug) return null;
  return `https://github.com/apps/${config.appSlug}/installations/new`;
}

export function githubAppPublicConfig() {
  const config = appConfig();
  return {
    configured: Boolean(config),
    appSlug: config?.appSlug ?? null,
    permissions: [
      "Contents (read & write)",
      "Pull requests (read & write)",
      "Metadata (read)",
      "Webhooks (read & write)",
      "Actions (read)",
    ],
    events: ["push", "pull_request"],
    capabilities: [
      "Codebase index & visualization",
      "Semantic search & Ask",
      "Branch push & pull requests",
      "QA sandbox clone",
    ],
  };
}
