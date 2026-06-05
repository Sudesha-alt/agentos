import { getDb } from "../jira-intake/sqliteStore";
import type { GitProviderId, GitRepoContext } from "../integrations/git/types";

export interface StoredGitCredentials {
  provider: GitProviderId;
  workspace: string;
  repoSlug: string;
  username: string | null;
  token: string;
  webhookSecret: string;
  defaultBranch: string;
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
      webhookSecret: process.env.GITHUB_WEBHOOK_SECRET?.trim() ?? "",
      defaultBranch: process.env.GIT_DEFAULT_BRANCH?.trim() || "main",
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
}): StoredGitCredentials {
  return {
    provider: row.provider as GitProviderId,
    workspace: row.workspace,
    repoSlug: row.repo_slug,
    username: row.username,
    token: row.token ?? "",
    webhookSecret: row.webhook_secret ?? "",
    defaultBranch: row.default_branch ?? "main",
    source: "database",
  };
}

export function loadGitCredentialsFromStore(): StoredGitCredentials | null {
  const row = getDb()
    .prepare(
      `SELECT provider, workspace, repo_slug, username, token, webhook_secret, default_branch
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
      }
    | undefined;

  if (row?.token && row.workspace && row.repo_slug) {
    const creds = rowToCredentials(row);
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

export function getGitCredentials(): StoredGitCredentials {
  if (!runtimeCreds?.token) {
    throw new Error(
      "Git provider not configured. Connect GitHub or Bitbucket under Admin → Git integration, or set GITHUB_* / BITBUCKET_* env vars."
    );
  }
  return runtimeCreds;
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
  const creds = runtimeCreds ?? loadGitCredentialsFromStore();
  if (!creds?.token) {
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
      source: "none",
    };
  }
  return {
    provider: creds.provider,
    workspace: creds.workspace,
    repoSlug: creds.repoSlug,
    username: creds.username,
    hasToken: Boolean(creds.token),
    tokenHint: tokenHint(creds.token),
    webhookSecret: creds.webhookSecret,
    defaultBranch: creds.defaultBranch,
    configured: true,
    source: creds.source,
  };
}

export function getGitWebhookSecret(provider: GitProviderId): string {
  const creds = runtimeCreds ?? loadGitCredentialsFromStore();
  if (creds?.webhookSecret) return creds.webhookSecret;
  if (provider === "github") return process.env.GITHUB_WEBHOOK_SECRET?.trim() ?? "";
  return process.env.BITBUCKET_WEBHOOK_SECRET?.trim() ?? "";
}

export function saveGitCredentials(input: {
  provider: GitProviderId;
  workspace: string;
  repoSlug: string;
  username?: string | null;
  token?: string;
  webhookSecret?: string;
  defaultBranch?: string;
}): void {
  const prior = runtimeCreds ?? loadGitCredentialsFromStore();
  const token = input.token?.trim() || prior?.token || "";
  if (!token) throw new Error("token is required on first connect");

  const creds: StoredGitCredentials = {
    provider: input.provider,
    workspace: input.workspace.trim(),
    repoSlug: input.repoSlug.trim(),
    username: input.username?.trim() || prior?.username || null,
    token,
    webhookSecret:
      input.webhookSecret?.trim() ?? prior?.webhookSecret ?? "",
    defaultBranch: input.defaultBranch?.trim() || prior?.defaultBranch || "main",
    source: "database",
  };

  getDb()
    .prepare(
      `INSERT INTO git_credentials (
        singleton_id, provider, workspace, repo_slug, username, token,
        webhook_secret, default_branch, updated_at
      ) VALUES (1, @provider, @workspace, @repoSlug, @username, @token,
        @webhookSecret, @defaultBranch, @updatedAt)
      ON CONFLICT(singleton_id) DO UPDATE SET
        provider = excluded.provider,
        workspace = excluded.workspace,
        repo_slug = excluded.repo_slug,
        username = excluded.username,
        token = excluded.token,
        webhook_secret = excluded.webhook_secret,
        default_branch = excluded.default_branch,
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
      updatedAt: nowIso(),
    });

  runtimeCreds = creds;
  applyGitCredentialsToProcessEnv(creds);
}

export function applyGitCredentialsToProcessEnv(creds: StoredGitCredentials): void {
  if (creds.provider === "github") {
    process.env.GITHUB_TOKEN = creds.token;
    process.env.GITHUB_REPO_OWNER = creds.workspace;
    process.env.GITHUB_REPO_NAME = creds.repoSlug;
    if (creds.webhookSecret) process.env.GITHUB_WEBHOOK_SECRET = creds.webhookSecret;
  } else {
    process.env.BITBUCKET_APP_PASSWORD = creds.token;
    process.env.BITBUCKET_WORKSPACE = creds.workspace;
    process.env.BITBUCKET_REPO_SLUG = creds.repoSlug;
    process.env.BITBUCKET_USERNAME = creds.username ?? creds.workspace;
    if (creds.webhookSecret) process.env.BITBUCKET_WEBHOOK_SECRET = creds.webhookSecret;
  }
}

export function validateGitConfig(): void {
  getGitCredentials();
}
