import crypto from "crypto";
import { getDb } from "../../jira-intake/sqliteStore";
import { getActiveOrganizationId } from "../../organization/context";
import {
  loadOrganizationJiraConfig,
  saveOrganizationJiraConfig,
} from "../../organization/jiraConfigStore";

export type JiraAuthMethod = "api_token" | "oauth";

export interface PipelineJiraCredentials {
  baseUrl: string;
  email: string;
  apiToken: string;
  webhookSecret: string;
  projectKeys: string[];
  authMethod: JiraAuthMethod;
  cloudId?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date | null;
  scopes?: string;
}

export interface PipelineJiraCredentialsPublic {
  baseUrl: string;
  email: string;
  hasApiToken: boolean;
  tokenHint: string | null;
  webhookSecret: string;
  projectKeys: string[];
  configured: boolean;
  source: "database" | "environment" | "none";
  authMethod?: JiraAuthMethod;
  connectedViaOAuth?: boolean;
  siteName?: string | null;
  oauthConfigured?: boolean;
}

let runtimeCreds: PipelineJiraCredentials | null = null;
const orgRuntimeCreds = new Map<string, PipelineJiraCredentials>();

export async function warmOrganizationJiraCredentials(
  organizationId: string
): Promise<void> {
  const fromDb = await loadOrganizationJiraConfig(organizationId);
  if (!fromDb) return;
  orgRuntimeCreds.set(organizationId, fromDb);
  if (getActiveOrganizationId() === organizationId) {
    runtimeCreds = fromDb;
  }
}

export function activateOrganizationJiraContext(organizationId: string | null): void {
  if (organizationId && orgRuntimeCreds.has(organizationId)) {
    runtimeCreds = orgRuntimeCreds.get(organizationId)!;
    return;
  }
  if (!organizationId) {
    runtimeCreds = null;
  }
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function tokenHint(token: string): string | null {
  if (!token || token.length < 4) return null;
  return `••••${token.slice(-4)}`;
}

function parseProjectKeys(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

function credentialsFromEnv(): PipelineJiraCredentials {
  const projectKeys = parseProjectKeys(
    process.env.PIPELINE_JIRA_PROJECT_KEYS ?? process.env.JIRA_PROJECT_KEYS
  );
  return {
    baseUrl: normalizeBaseUrl(
      process.env.PIPELINE_JIRA_BASE_URL?.trim() ||
        process.env.JIRA_BASE_URL?.trim() ||
        ""
    ),
    email: (
      process.env.PIPELINE_JIRA_EMAIL?.trim() ||
      process.env.JIRA_EMAIL?.trim() ||
      ""
    ),
    apiToken: (
      process.env.PIPELINE_JIRA_API_TOKEN?.trim() ||
      process.env.JIRA_API_TOKEN?.trim() ||
      ""
    ),
    webhookSecret: (
      process.env.PIPELINE_JIRA_WEBHOOK_SECRET?.trim() ||
      process.env.JIRA_WEBHOOK_SECRET?.trim() ||
      ""
    ),
    projectKeys,
    authMethod: "api_token",
  };
}

export function loadPipelineJiraCredentialsFromStore(): PipelineJiraCredentials {
  const row = getDb()
    .prepare(
      `SELECT base_url, email, api_token, webhook_secret, project_keys_json
       FROM pipeline_jira_credentials WHERE singleton_id = 1`
    )
    .get() as
    | {
        base_url: string | null;
        email: string | null;
        api_token: string | null;
        webhook_secret: string | null;
        project_keys_json: string | null;
      }
    | undefined;

  const env = credentialsFromEnv();
  if (!row) {
    runtimeCreds = env;
    return env;
  }

  let projectKeys: string[] = env.projectKeys;
  try {
    const parsed = JSON.parse(row.project_keys_json || "[]");
    if (Array.isArray(parsed) && parsed.length) {
      projectKeys = parsed.map(String);
    }
  } catch {
    /* keep env defaults */
  }

  const merged: PipelineJiraCredentials = {
    baseUrl: normalizeBaseUrl(row.base_url || env.baseUrl),
    email: row.email || env.email,
    apiToken: row.api_token || env.apiToken,
    webhookSecret: row.webhook_secret || env.webhookSecret,
    projectKeys,
    authMethod: "api_token",
  };
  runtimeCreds = merged;
  return merged;
}

export function getActivePipelineJiraCredentials(): PipelineJiraCredentials {
  const orgId = getActiveOrganizationId();
  if (orgId) {
    if (orgRuntimeCreds.has(orgId)) {
      return orgRuntimeCreds.get(orgId)!;
    }
    return {
      baseUrl: "",
      email: "",
      apiToken: "",
      webhookSecret: "",
      projectKeys: [],
      authMethod: "api_token",
    };
  }
  if (runtimeCreds) return runtimeCreds;
  return loadPipelineJiraCredentialsFromStore();
}

export function getPipelineWebhookSecret(): string {
  return getActivePipelineJiraCredentials().webhookSecret;
}

export function isPipelineJiraConfigured(): boolean {
  const creds = getActivePipelineJiraCredentials();
  if (creds.authMethod === "oauth") {
    return Boolean(creds.baseUrl && creds.cloudId && creds.accessToken);
  }
  return Boolean(creds.baseUrl && creds.email && creds.apiToken);
}

export function validatePipelineJiraConfig(): void {
  const creds = getActivePipelineJiraCredentials();
  const missing: string[] = [];

  if (!creds.baseUrl) missing.push("baseUrl");

  if (creds.authMethod === "oauth") {
    if (!creds.cloudId) missing.push("cloudId");
    if (!creds.accessToken) missing.push("accessToken");
  } else {
    if (!creds.email) missing.push("email");
    if (!creds.apiToken) missing.push("apiToken");
  }

  if (missing.length) {
    throw new Error(`Pipeline Jira not configured: ${missing.join(", ")}`);
  }
}

export function getPublicPipelineJiraCredentials(): PipelineJiraCredentialsPublic {
  const row = getDb()
    .prepare(
      `SELECT base_url, email, api_token, webhook_secret, project_keys_json
       FROM pipeline_jira_credentials WHERE singleton_id = 1`
    )
    .get() as
    | {
        base_url: string | null;
        email: string | null;
        api_token: string | null;
        webhook_secret: string | null;
        project_keys_json: string | null;
      }
    | undefined;

  const env = credentialsFromEnv();
  const storedToken = row?.api_token || "";
  const merged: PipelineJiraCredentials = row
    ? {
        baseUrl: normalizeBaseUrl(row.base_url || env.baseUrl),
        email: row.email || env.email,
        apiToken: storedToken || env.apiToken,
        webhookSecret: row.webhook_secret || env.webhookSecret,
        projectKeys: (() => {
          try {
            const parsed = JSON.parse(row.project_keys_json || "[]");
            return Array.isArray(parsed) && parsed.length
              ? parsed.map(String)
              : env.projectKeys;
          } catch {
            return env.projectKeys;
          }
        })(),
        authMethod: "api_token",
      }
    : env;

  const configured = Boolean(
    merged.baseUrl && merged.email && merged.apiToken
  );

  return {
    baseUrl: merged.baseUrl,
    email: merged.email,
    hasApiToken: Boolean(merged.apiToken),
    tokenHint: tokenHint(merged.apiToken),
    webhookSecret: merged.webhookSecret,
    projectKeys: merged.projectKeys,
    configured,
    source: configured
      ? storedToken
        ? "database"
        : "environment"
      : "none",
    authMethod: "api_token",
  };
}

export async function savePipelineJiraCredentialsForOrganization(
  organizationId: string,
  input: {
    baseUrl: string;
    email: string;
    apiToken?: string;
    webhookSecret?: string;
    projectKeys?: string[];
    boardId?: string;
    authMethod?: JiraAuthMethod;
  }
): Promise<PipelineJiraCredentials> {
  const creds = await saveOrganizationJiraConfig(organizationId, {
    ...input,
    authMethod: input.authMethod ?? "api_token",
  });
  orgRuntimeCreds.set(organizationId, creds);
  runtimeCreds = creds;
  return creds;
}

export async function savePipelineJiraOAuthCredentialsForOrganization(
  organizationId: string,
  creds: PipelineJiraCredentials
): Promise<PipelineJiraCredentials> {
  orgRuntimeCreds.set(organizationId, creds);
  runtimeCreds = creds;
  return creds;
}

export function savePipelineJiraCredentials(input: {
  baseUrl: string;
  email: string;
  apiToken?: string;
  webhookSecret?: string;
  projectKeys?: string[];
  boardId?: string;
}): PipelineJiraCredentials {
  const existing = getDb()
    .prepare(
      `SELECT api_token, webhook_secret, project_keys_json, board_id
       FROM pipeline_jira_credentials WHERE singleton_id = 1`
    )
    .get() as
    | {
        api_token: string | null;
        webhook_secret: string | null;
        project_keys_json: string | null;
        board_id: string | null;
      }
    | undefined;

  const env = credentialsFromEnv();
  const apiToken =
    input.apiToken?.trim() || existing?.api_token || env.apiToken;
  const webhookSecret =
    input.webhookSecret?.trim() ||
    existing?.webhook_secret ||
    env.webhookSecret ||
    crypto.randomBytes(18).toString("hex");

  const projectKeys =
    input.projectKeys?.length
      ? input.projectKeys
      : (() => {
          try {
            const parsed = JSON.parse(existing?.project_keys_json || "[]");
            return Array.isArray(parsed) && parsed.length
              ? parsed.map(String)
              : env.projectKeys;
          } catch {
            return env.projectKeys;
          }
        })();

  const boardId =
    input.boardId?.trim() ||
    existing?.board_id ||
    process.env.PIPELINE_JIRA_BOARD_ID?.trim() ||
    "";

  const creds: PipelineJiraCredentials = {
    baseUrl: normalizeBaseUrl(input.baseUrl),
    email: input.email.trim(),
    apiToken,
    webhookSecret,
    projectKeys,
    authMethod: "api_token",
  };

  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO pipeline_jira_credentials (
        singleton_id, base_url, email, api_token, webhook_secret, project_keys_json, board_id, updated_at
      ) VALUES (1, @baseUrl, @email, @apiToken, @webhookSecret, @projectKeysJson, @boardId, @now)
      ON CONFLICT(singleton_id) DO UPDATE SET
        base_url = excluded.base_url,
        email = excluded.email,
        api_token = excluded.api_token,
        webhook_secret = excluded.webhook_secret,
        project_keys_json = excluded.project_keys_json,
        board_id = COALESCE(excluded.board_id, pipeline_jira_credentials.board_id),
        updated_at = excluded.updated_at`
    )
    .run({
      baseUrl: creds.baseUrl,
      email: creds.email,
      apiToken: creds.apiToken,
      webhookSecret: creds.webhookSecret,
      projectKeysJson: JSON.stringify(creds.projectKeys),
      boardId: boardId || null,
      now,
    });

  runtimeCreds = creds;
  return creds;
}
