import { prisma } from "../db/client";
import {
  getInstallationAccessToken,
  isGithubInstallationMissingError,
} from "../integrations/git/githubApp";
import { removeGithubInstallation } from "./githubInstallationStore";
import { getDb } from "../jira-intake/sqliteStore";
import { getActiveOrganizationId } from "../organization/context";
import {
  loadOrganizationGitConfig,
  saveOrganizationGitConfig,
  type OrganizationGitCredentials,
} from "../organization/gitConfigStore";
import { logger } from "../utils/logger";
import type { GitProviderId, GitRepoContext } from "../integrations/git/types";

const prismaAny = prisma as any;

export type GitAuthMethod = "pat" | "github_app";

export interface StoredGitCredentials {
  provider: GitProviderId;
  workspace: string;
  repoSlug: string;
  username: string | null;
  token: string;
  webhookSecret: string;
  defaultBranch: string;
  installationId: string | null;
  authMethod: GitAuthMethod;
  source: "database" | "environment" | "none";
}

export interface PublicGitCredentials {
  provider: GitProviderId | null;
  workspace: string;
  repoSlug: string;
  username: string | null;
  hasToken: boolean;
  tokenHint: string | null;
  webhookSecret: string;
  defaultBranch: string;
  configured: boolean;
  authMethod: GitAuthMethod | null;
  installationId: string | null;
  source: StoredGitCredentials["source"];
}

function nowIso(): string {
  return new Date().toISOString();
}

function tokenHint(token: string): string | null {
  if (!token || token.length < 8) return null;
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

function credentialsFromEnv(): StoredGitCredentials | null {
  const githubToken = process.env.GITHUB_TOKEN?.trim();
  const githubOwner = process.env.GITHUB_REPO_OWNER?.trim();
  const githubRepo = process.env.GITHUB_REPO_NAME?.trim();
  if (githubToken && githubOwner && githubRepo) {
    return {
      provider: "github",
      workspace: githubOwner,
      repoSlug: githubRepo,
      username: null,
      token: githubToken,
      webhookSecret:
        process.env.GITHUB_APP_WEBHOOK_SECRET?.trim() ??
        process.env.GITHUB_WEBHOOK_SECRET?.trim() ??
        "",
      defaultBranch: process.env.GIT_DEFAULT_BRANCH?.trim() || "main",
      installationId: process.env.GITHUB_APP_INSTALLATION_ID?.trim() || null,
      authMethod: process.env.GITHUB_APP_INSTALLATION_ID ? "github_app" : "pat",
      source: "environment",
    };
  }

  const bbToken = process.env.BITBUCKET_APP_PASSWORD?.trim();
  const bbWorkspace = process.env.BITBUCKET_WORKSPACE?.trim();
  const bbRepo = process.env.BITBUCKET_REPO_SLUG?.trim();
  const bbUser = process.env.BITBUCKET_USERNAME?.trim();
  if (bbToken && bbWorkspace && bbRepo && bbUser) {
    return {
      provider: "bitbucket",
      workspace: bbWorkspace,
      repoSlug: bbRepo,
      username: bbUser,
      token: bbToken,
      webhookSecret: process.env.BITBUCKET_WEBHOOK_SECRET?.trim() ?? "",
      defaultBranch: process.env.GIT_DEFAULT_BRANCH?.trim() || "main",
      installationId: null,
      authMethod: "pat",
      source: "environment",
    };
  }

  return null;
}

function rowToCredentials(row: {
  provider: string;
  workspace: string;
  repo_slug: string;
  username: string | null;
  token: string | null;
  webhook_secret: string | null;
  default_branch: string | null;
  installation_id?: string | null;
  auth_method?: string | null;
}): StoredGitCredentials {
  return {
    provider: row.provider as GitProviderId,
    workspace: row.workspace,
    repoSlug: row.repo_slug,
    username: row.username,
    token: row.token ?? "",
    webhookSecret: row.webhook_secret ?? "",
    defaultBranch: row.default_branch ?? "main",
    installationId: row.installation_id ?? null,
    authMethod: (row.auth_method as GitAuthMethod) ?? "pat",
    source: "database",
  };
}

export function loadGitCredentialsFromStore(): StoredGitCredentials | null {
  if (getActiveOrganizationId()) {
    return null;
  }
  const row = getDb()
    .prepare(
      `SELECT provider, workspace, repo_slug, username, token, webhook_secret,
              default_branch, installation_id, auth_method
       FROM git_credentials WHERE singleton_id = 1`
    )
    .get() as
    | {
        provider: string;
        workspace: string;
        repo_slug: string;
        username: string | null;
        token: string | null;
        webhook_secret: string | null;
        default_branch: string | null;
        installation_id: string | null;
        auth_method: string | null;
      }
    | undefined;

  const hasGithubAppInstall = Boolean(row?.installation_id && row.auth_method === "github_app");
  const hasPat = Boolean(row?.token && row.workspace && row.repo_slug);

  if (hasGithubAppInstall || hasPat) {
    const creds = rowToCredentials(row!);
    runtimeCreds = creds;
    applyGitCredentialsToProcessEnv(creds);
    return creds;
  }

  const env = credentialsFromEnv();
  if (env) {
    runtimeCreds = env;
    applyGitCredentialsToProcessEnv(env);
    return env;
  }
  runtimeCreds = null;
  return null;
}

let runtimeCreds: StoredGitCredentials | null = null;
const orgRuntimeCreds = new Map<string, StoredGitCredentials>();

function orgCredsToStored(creds: OrganizationGitCredentials): StoredGitCredentials {
  return {
    provider: creds.provider,
    workspace: creds.workspace,
    repoSlug: creds.repoSlug,
    username: creds.username,
    token: creds.token,
    webhookSecret: creds.webhookSecret,
    defaultBranch: creds.defaultBranch,
    installationId: creds.installationId,
    authMethod: creds.authMethod,
    source: "database",
  };
}

export async function warmOrganizationGitCredentials(
  organizationId: string
): Promise<void> {
  const fromDb = await loadOrganizationGitConfig(organizationId);
  if (!fromDb) return;
  const stored = orgCredsToStored(fromDb);
  orgRuntimeCreds.set(organizationId, stored);
  if (getActiveOrganizationId() === organizationId) {
    runtimeCreds = stored;
    applyGitCredentialsToProcessEnv(stored);
  }
}

export function activateOrganizationGitContext(organizationId: string | null): void {
  if (organizationId && orgRuntimeCreds.has(organizationId)) {
    runtimeCreds = orgRuntimeCreds.get(organizationId)!;
    applyGitCredentialsToProcessEnv(runtimeCreds);
    return;
  }
  if (!organizationId) {
    runtimeCreds = null;
  }
}

function getActiveGitCredentialsInternal(): StoredGitCredentials | null {
  const orgId = getActiveOrganizationId();
  if (orgId) {
    if (orgRuntimeCreds.has(orgId)) {
      return orgRuntimeCreds.get(orgId)!;
    }
    return null;
  }
  return runtimeCreds ?? loadGitCredentialsFromStore();
}

export function getGitCredentials(): StoredGitCredentials {
  const creds = getActiveGitCredentialsInternal();
  if (!creds) {
    throw new Error(
      "Git provider not configured. Connect GitHub or Bitbucket under Admin → Git integration."
    );
  }
  if (creds.authMethod === "github_app" && creds.installationId) {
    return creds;
  }
  if (!creds.token) {
    throw new Error("Git provider not configured.");
  }
  return creds;
}

export async function resolveGithubAccessToken(
  creds: StoredGitCredentials = getGitCredentials()
): Promise<string> {
  if (creds.authMethod === "github_app" && creds.installationId) {
    return getInstallationAccessToken(creds.installationId);
  }
  if (!creds.token) {
    throw new Error("GitHub token is not configured");
  }
  return creds.token;
}

export function getRepoContext(): GitRepoContext {
  const creds = getGitCredentials();
  return {
    provider: creds.provider,
    workspace: creds.workspace,
    repoSlug: creds.repoSlug,
    defaultBranch: creds.defaultBranch,
  };
}

export function getPublicGitCredentials(): PublicGitCredentials {
  const creds = getActiveGitCredentialsInternal();
  if (!creds || (!creds.token && !creds.installationId)) {
    return {
      provider: null,
      workspace: "",
      repoSlug: "",
      username: null,
      hasToken: false,
      tokenHint: null,
      webhookSecret: "",
      defaultBranch: "main",
      configured: false,
      authMethod: null,
      installationId: null,
      source: "none",
    };
  }
  const connected =
    creds.authMethod === "github_app"
      ? Boolean(creds.installationId && creds.workspace && creds.repoSlug)
      : Boolean(creds.token && creds.workspace && creds.repoSlug);

  return {
    provider: creds.provider,
    workspace: creds.workspace,
    repoSlug: creds.repoSlug,
    username: creds.username,
    hasToken: Boolean(creds.token),
    tokenHint: creds.token ? tokenHint(creds.token) : null,
    webhookSecret: creds.webhookSecret,
    defaultBranch: creds.defaultBranch,
    configured: connected,
    authMethod: creds.authMethod,
    installationId: creds.installationId,
    source: creds.source,
  };
}

export function getGitWebhookSecret(provider: GitProviderId): string {
  const creds = getActiveGitCredentialsInternal();
  if (creds?.webhookSecret) return creds.webhookSecret;
  if (getActiveOrganizationId()) return "";
  if (provider === "github") {
    return (
      process.env.GITHUB_APP_WEBHOOK_SECRET?.trim() ??
      process.env.GITHUB_WEBHOOK_SECRET?.trim() ??
      ""
    );
  }
  return process.env.BITBUCKET_WEBHOOK_SECRET?.trim() ?? "";
}

export async function saveGitCredentialsForOrganization(
  organizationId: string,
  input: {
    provider: GitProviderId;
    workspace: string;
    repoSlug: string;
    username?: string | null;
    token?: string;
    webhookSecret?: string;
    defaultBranch?: string;
    installationId?: string | null;
    authMethod?: GitAuthMethod;
  }
): Promise<StoredGitCredentials> {
  const creds = await saveOrganizationGitConfig(organizationId, input);
  const stored = orgCredsToStored(creds);
  orgRuntimeCreds.set(organizationId, stored);
  runtimeCreds = stored;
  applyGitCredentialsToProcessEnv(stored);
  return stored;
}

export function saveGithubAppInstallation(installationId: string): void {
  const prior = runtimeCreds ?? loadGitCredentialsFromStore();
  getDb()
    .prepare(
      `INSERT INTO git_credentials (
        singleton_id, provider, workspace, repo_slug, username, token,
        webhook_secret, default_branch, installation_id, auth_method, updated_at
      ) VALUES (1, 'github', @workspace, @repoSlug, NULL, @token,
        @webhookSecret, @defaultBranch, @installationId, 'github_app', @updatedAt)
      ON CONFLICT(singleton_id) DO UPDATE SET
        provider = 'github',
        installation_id = excluded.installation_id,
        auth_method = 'github_app',
        updated_at = excluded.updated_at`
    )
    .run({
      workspace: prior?.workspace ?? "",
      repoSlug: prior?.repoSlug ?? "",
      token: prior?.token ?? "",
      webhookSecret: prior?.webhookSecret ?? "",
      defaultBranch: prior?.defaultBranch ?? "main",
      installationId,
      updatedAt: nowIso(),
    });

  runtimeCreds = {
    provider: "github",
    workspace: prior?.workspace ?? "",
    repoSlug: prior?.repoSlug ?? "",
    username: null,
    token: prior?.token ?? "",
    webhookSecret: prior?.webhookSecret ?? "",
    defaultBranch: prior?.defaultBranch ?? "main",
    installationId,
    authMethod: "github_app",
    source: "database",
  };
}

export function saveGitCredentials(input: {
  provider: GitProviderId;
  workspace: string;
  repoSlug: string;
  username?: string | null;
  token?: string;
  webhookSecret?: string;
  defaultBranch?: string;
  installationId?: string | null;
  authMethod?: GitAuthMethod;
}): void {
  const prior = runtimeCreds ?? loadGitCredentialsFromStore();
  const token = input.token?.trim() || prior?.token || "";
  const authMethod = input.authMethod ?? prior?.authMethod ?? "pat";
  const installationId =
    input.installationId !== undefined
      ? input.installationId
      : prior?.installationId ?? null;

  if (authMethod === "pat" && !token) {
    throw new Error("token is required on first connect");
  }
  if (authMethod === "github_app" && !installationId) {
    throw new Error("installationId is required for GitHub App auth");
  }

  const creds: StoredGitCredentials = {
    provider: input.provider,
    workspace: input.workspace.trim(),
    repoSlug: input.repoSlug.trim(),
    username: input.username?.trim() || prior?.username || null,
    token,
    webhookSecret: input.webhookSecret?.trim() ?? prior?.webhookSecret ?? "",
    defaultBranch: input.defaultBranch?.trim() || prior?.defaultBranch || "main",
    installationId,
    authMethod,
    source: "database",
  };

  getDb()
    .prepare(
      `INSERT INTO git_credentials (
        singleton_id, provider, workspace, repo_slug, username, token,
        webhook_secret, default_branch, installation_id, auth_method, updated_at
      ) VALUES (1, @provider, @workspace, @repoSlug, @username, @token,
        @webhookSecret, @defaultBranch, @installationId, @authMethod, @updatedAt)
      ON CONFLICT(singleton_id) DO UPDATE SET
        provider = excluded.provider,
        workspace = excluded.workspace,
        repo_slug = excluded.repo_slug,
        username = excluded.username,
        token = excluded.token,
        webhook_secret = excluded.webhook_secret,
        default_branch = excluded.default_branch,
        installation_id = excluded.installation_id,
        auth_method = excluded.auth_method,
        updated_at = excluded.updated_at`
    )
    .run({
      provider: creds.provider,
      workspace: creds.workspace,
      repoSlug: creds.repoSlug,
      username: creds.username,
      token: creds.token,
      webhookSecret: creds.webhookSecret,
      defaultBranch: creds.defaultBranch,
      installationId: creds.installationId,
      authMethod: creds.authMethod,
      updatedAt: nowIso(),
    });

  runtimeCreds = creds;
  applyGitCredentialsToProcessEnv(creds);
}

export function applyGitCredentialsToProcessEnv(creds: StoredGitCredentials): void {
  if (creds.provider === "github") {
    if (creds.token) process.env.GITHUB_TOKEN = creds.token;
    process.env.GITHUB_REPO_OWNER = creds.workspace;
    process.env.GITHUB_REPO_NAME = creds.repoSlug;
    if (creds.installationId) {
      process.env.GITHUB_APP_INSTALLATION_ID = creds.installationId;
    }
    if (creds.webhookSecret) process.env.GITHUB_WEBHOOK_SECRET = creds.webhookSecret;
  } else {
    process.env.BITBUCKET_APP_PASSWORD = creds.token;
    process.env.BITBUCKET_WORKSPACE = creds.workspace;
    process.env.BITBUCKET_REPO_SLUG = creds.repoSlug;
    process.env.BITBUCKET_USERNAME = creds.username ?? creds.workspace;
    if (creds.webhookSecret) process.env.BITBUCKET_WEBHOOK_SECRET = creds.webhookSecret;
  }
}

export function clearGitCredentials(): void {
  getDb().prepare(`DELETE FROM git_credentials WHERE singleton_id = 1`).run();
  runtimeCreds = null;

  delete process.env.GITHUB_TOKEN;
  delete process.env.GITHUB_REPO_OWNER;
  delete process.env.GITHUB_REPO_NAME;
  delete process.env.GITHUB_APP_INSTALLATION_ID;
  delete process.env.GITHUB_WEBHOOK_SECRET;
  delete process.env.BITBUCKET_APP_PASSWORD;
  delete process.env.BITBUCKET_WORKSPACE;
  delete process.env.BITBUCKET_REPO_SLUG;
  delete process.env.BITBUCKET_USERNAME;
  delete process.env.BITBUCKET_WEBHOOK_SECRET;
}

export function validateGitConfig(): void {
  const creds = getGitCredentials();
  if (creds.authMethod === "github_app") {
    if (!creds.installationId || !creds.workspace || !creds.repoSlug) {
      throw new Error("GitHub App installation incomplete — select a repository");
    }
    return;
  }
  if (!creds.token || !creds.workspace || !creds.repoSlug) {
    throw new Error("Git credentials incomplete");
  }
}

/** Re-hydrate SQLite/runtime creds from Postgres after Render restarts or partial installs. */
export async function restoreGitCredentialsFromPostgres(): Promise<boolean> {
  let installationId: string | null = null;
  try {
    const install = (await prismaAny.githubInstallation.findFirst({
      orderBy: { updatedAt: "desc" },
    })) as {
      installationId: string;
      selectedRepoOwner: string | null;
      selectedRepoName: string | null;
    } | null;

    if (!install?.installationId) return false;
    installationId = install.installationId;

    const current = runtimeCreds ?? loadGitCredentialsFromStore();

    if (install.selectedRepoOwner && install.selectedRepoName) {
      if (
        current?.workspace === install.selectedRepoOwner &&
        current?.repoSlug === install.selectedRepoName &&
        current?.installationId === install.installationId
      ) {
        return true;
      }

      const repo = (await prismaAny.githubRepository.findFirst({
        where: {
          installationId: install.installationId,
          owner: install.selectedRepoOwner,
          name: install.selectedRepoName,
        },
      })) as { defaultBranch: string } | null;

      const token = await getInstallationAccessToken(install.installationId);
      saveGitCredentials({
        provider: "github",
        workspace: install.selectedRepoOwner,
        repoSlug: install.selectedRepoName,
        token,
        authMethod: "github_app",
        installationId: install.installationId,
        defaultBranch: repo?.defaultBranch ?? "main",
      });
      return true;
    }

    if (!current?.installationId) {
      saveGithubAppInstallation(install.installationId);
      return true;
    }

    return false;
  } catch (err) {
    if (isGithubInstallationMissingError(err) && installationId) {
      await removeGithubInstallation(installationId).catch(() => {});
      clearGitCredentials();

      logger.warn(
        {
          installationId,
          hint: "Reconnect GitHub on /app/git — installation was removed on GitHub or GITHUB_APP_ID does not match this install.",
        },
        "stale github installation cleared from postgres"
      );
      return false;
    }

    logger.warn({ err }, "restore git credentials from postgres failed");
    return false;
  }
}
