import crypto from "crypto";
import { prisma } from "../db/client";
import type { PipelineJiraCredentials } from "../pipeline/jira/credentialsStore";
import { ValidationError } from "../utils/errors";

export type JiraAuthMethod = "api_token" | "oauth";

function parseProjectKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String).filter(Boolean);
}

function rowToCredentials(row: {
  baseUrl: string;
  email: string;
  apiToken: string;
  authMethod: string;
  cloudId: string | null;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date | null;
  scopes: string;
  webhookSecret: string;
  projectKeysJson: unknown;
}): PipelineJiraCredentials {
  return {
    baseUrl: row.baseUrl.replace(/\/+$/, ""),
    email: row.email,
    apiToken: row.apiToken,
    authMethod: row.authMethod === "oauth" ? "oauth" : "api_token",
    cloudId: row.cloudId ?? undefined,
    accessToken: row.accessToken || undefined,
    refreshToken: row.refreshToken || undefined,
    tokenExpiresAt: row.tokenExpiresAt,
    scopes: row.scopes || undefined,
    webhookSecret: row.webhookSecret,
    projectKeys: parseProjectKeys(row.projectKeysJson),
  };
}

export async function loadOrganizationJiraConfig(
  organizationId: string
): Promise<PipelineJiraCredentials | null> {
  const row = await prisma.organizationJiraConfig.findUnique({
    where: { organizationId },
  });
  if (!row) return null;
  return rowToCredentials(row);
}

export async function saveOrganizationJiraConfig(
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
  const existing = await prisma.organizationJiraConfig.findUnique({
    where: { organizationId },
  });

  const apiToken = input.apiToken?.trim() || existing?.apiToken || "";
  const webhookSecret =
    input.webhookSecret?.trim() || existing?.webhookSecret || "";
  const authMethod: JiraAuthMethod =
    input.authMethod ??
    (existing?.authMethod === "oauth" ? "oauth" : "api_token");

  if (
    authMethod === "oauth" &&
    !(existing?.cloudId && existing.accessToken?.trim())
  ) {
    throw new ValidationError(
      "Cannot save Jira settings as OAuth without a completed Atlassian connection. Use Connect with Atlassian first."
    );
  }

  const creds: PipelineJiraCredentials = {
    baseUrl: input.baseUrl.replace(/\/+$/, ""),
    email: input.email.trim() || existing?.email || "",
    apiToken,
    authMethod,
    cloudId: existing?.cloudId ?? undefined,
    accessToken: existing?.accessToken || undefined,
    refreshToken: existing?.refreshToken || undefined,
    tokenExpiresAt: existing?.tokenExpiresAt ?? null,
    scopes: existing?.scopes || undefined,
    webhookSecret,
    projectKeys: input.projectKeys?.length
      ? input.projectKeys
      : parseProjectKeys(existing?.projectKeysJson),
  };

  await prisma.organizationJiraConfig.upsert({
    where: { organizationId },
    create: {
      organizationId,
      baseUrl: creds.baseUrl,
      email: creds.email,
      apiToken: creds.apiToken,
      authMethod: creds.authMethod,
      cloudId: creds.cloudId ?? null,
      accessToken: creds.accessToken ?? "",
      refreshToken: creds.refreshToken ?? "",
      tokenExpiresAt: creds.tokenExpiresAt ?? null,
      scopes: creds.scopes ?? "",
      webhookSecret: creds.webhookSecret,
      projectKeysJson: creds.projectKeys,
      boardId: input.boardId?.trim() || existing?.boardId || null,
      updatedAt: new Date(),
    },
    update: {
      baseUrl: creds.baseUrl,
      email: creds.email,
      authMethod: creds.authMethod,
      ...(input.apiToken?.trim() ? { apiToken: creds.apiToken } : {}),
      ...(input.webhookSecret?.trim() ? { webhookSecret: creds.webhookSecret } : {}),
      ...(input.projectKeys?.length ? { projectKeysJson: creds.projectKeys } : {}),
      ...(input.boardId?.trim() ? { boardId: input.boardId.trim() } : {}),
      updatedAt: new Date(),
    },
  });

  return creds;
}

export async function saveOrganizationJiraOAuthConfig(
  organizationId: string,
  input: {
    baseUrl: string;
    email: string;
    cloudId: string;
    accessToken: string;
    refreshToken: string;
    tokenExpiresAt: Date;
    scopes: string;
    webhookSecret?: string;
    projectKeys?: string[];
  }
): Promise<PipelineJiraCredentials> {
  const existing = await prisma.organizationJiraConfig.findUnique({
    where: { organizationId },
  });

  const webhookSecret =
    input.webhookSecret?.trim() ||
    existing?.webhookSecret ||
    crypto.randomBytes(18).toString("hex");

  const creds: PipelineJiraCredentials = {
    baseUrl: input.baseUrl.replace(/\/+$/, ""),
    email: input.email.trim(),
    apiToken: existing?.apiToken ?? "",
    authMethod: "oauth",
    cloudId: input.cloudId,
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    tokenExpiresAt: input.tokenExpiresAt,
    scopes: input.scopes,
    webhookSecret,
    projectKeys: input.projectKeys?.length
      ? input.projectKeys
      : parseProjectKeys(existing?.projectKeysJson),
  };

  await prisma.organizationJiraConfig.upsert({
    where: { organizationId },
    create: {
      organizationId,
      baseUrl: creds.baseUrl,
      email: creds.email,
      apiToken: creds.apiToken,
      authMethod: "oauth",
      cloudId: creds.cloudId,
      accessToken: creds.accessToken ?? "",
      refreshToken: creds.refreshToken ?? "",
      tokenExpiresAt: creds.tokenExpiresAt ?? null,
      scopes: creds.scopes ?? "",
      webhookSecret: creds.webhookSecret,
      projectKeysJson: creds.projectKeys,
      updatedAt: new Date(),
    },
    update: {
      baseUrl: creds.baseUrl,
      email: creds.email,
      authMethod: "oauth",
      cloudId: creds.cloudId,
      accessToken: creds.accessToken ?? "",
      refreshToken: creds.refreshToken ?? "",
      tokenExpiresAt: creds.tokenExpiresAt ?? null,
      scopes: creds.scopes ?? "",
      webhookSecret: creds.webhookSecret,
      ...(input.projectKeys?.length ? { projectKeysJson: creds.projectKeys } : {}),
      updatedAt: new Date(),
    },
  });

  return creds;
}

export async function saveOrganizationJiraOAuthTokens(
  organizationId: string,
  input: {
    accessToken: string;
    refreshToken: string;
    tokenExpiresAt: Date;
    scopes?: string;
  }
): Promise<void> {
  if (!input.accessToken?.trim()) {
    throw new Error("Atlassian token refresh returned an empty access token");
  }
  await prisma.organizationJiraConfig.update({
    where: { organizationId },
    data: {
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      tokenExpiresAt: input.tokenExpiresAt,
      ...(input.scopes ? { scopes: input.scopes } : {}),
      updatedAt: new Date(),
    },
  });
}

export async function clearOrganizationJiraConfig(
  organizationId: string
): Promise<void> {
  await prisma.organizationJiraConfig.deleteMany({
    where: { organizationId },
  });
  const { clearOrganizationIntakeMapping } = await import(
    "../pipeline/jira/intakeConfig"
  );
  clearOrganizationIntakeMapping(organizationId);
}

/** Remove all Jira integration data for a workspace (DB + in-memory creds). */
export async function purgeOrganizationJiraIntegration(
  organizationId: string
): Promise<void> {
  await clearOrganizationJiraConfig(organizationId);
  const { clearOrganizationJiraRuntime } = await import(
    "../pipeline/jira/credentialsStore"
  );
  clearOrganizationJiraRuntime(organizationId);
}

export async function saveOrganizationPipelineIntake(
  organizationId: string,
  input: {
    boardId?: string;
    columnName: string;
    statuses: string[];
  }
): Promise<void> {
  const existing = await prisma.organizationJiraConfig.findUnique({
    where: { organizationId },
    select: { organizationId: true },
  });
  if (!existing) {
    throw new ValidationError(
      "Jira is not connected for this workspace. Connect via OAuth or API token first."
    );
  }

  await prisma.organizationJiraConfig.update({
    where: { organizationId },
    data: {
      ...(input.boardId?.trim() ? { boardId: input.boardId.trim() } : {}),
      aiWorkerColumnName: input.columnName,
      aiWorkerStatusesJson: input.statuses,
      updatedAt: new Date(),
    },
  });
  const { warmOrganizationIntakeMapping } = await import(
    "../pipeline/jira/intakeConfig"
  );
  await warmOrganizationIntakeMapping(organizationId);
}

export async function saveOrganizationReferenceColumns(
  organizationId: string,
  input: {
    columnNames: string[];
    statuses: string[];
  }
): Promise<void> {
  const existing = await prisma.organizationJiraConfig.findUnique({
    where: { organizationId },
    select: { organizationId: true },
  });
  if (!existing) {
    throw new ValidationError(
      "Jira is not connected for this workspace. Connect via OAuth or API token first."
    );
  }

  await prisma.organizationJiraConfig.update({
    where: { organizationId },
    data: {
      referenceColumnNamesJson: input.columnNames,
      referenceStatusesJson: input.statuses,
      updatedAt: new Date(),
    },
  });
  const { warmOrganizationIntakeMapping } = await import(
    "../pipeline/jira/intakeConfig"
  );
  await warmOrganizationIntakeMapping(organizationId);
}

export async function getPublicOrganizationJiraConfig(organizationId: string) {
  const row = await prisma.organizationJiraConfig.findUnique({
    where: { organizationId },
  });

  if (!row) {
    return {
      baseUrl: "",
      email: "",
      hasApiToken: false,
      tokenHint: null,
      webhookSecret: "",
      projectKeys: [],
      configured: false,
      source: "none" as const,
      authMethod: "api_token" as const,
      connectedViaOAuth: false,
      siteName: null as string | null,
      oauthConfigured: false,
    };
  }

  const creds = rowToCredentials(row);
  const authMethod = creds.authMethod;
  const connectedViaOAuth = authMethod === "oauth" && Boolean(creds.cloudId && creds.accessToken);

  const tokenHint =
    authMethod === "api_token" && creds.apiToken && creds.apiToken.length >= 4
      ? `••••${creds.apiToken.slice(-4)}`
      : connectedViaOAuth
        ? "OAuth"
        : null;

  const configured =
    authMethod === "oauth"
      ? Boolean(creds.baseUrl && creds.cloudId && creds.accessToken)
      : Boolean(creds.baseUrl && creds.email && creds.apiToken);

  const siteName = connectedViaOAuth
    ? creds.baseUrl.replace(/^https?:\/\//, "").replace(/\.atlassian\.net.*$/, "")
    : null;

  return {
    baseUrl: creds.baseUrl,
    email: creds.email,
    hasApiToken: Boolean(creds.apiToken),
    tokenHint,
    webhookSecret: creds.webhookSecret,
    projectKeys: creds.projectKeys,
    configured,
    source: "database" as const,
    authMethod,
    connectedViaOAuth,
    siteName,
    oauthConfigured: connectedViaOAuth,
  };
}

export function isAtlassianOAuthEnabled(): boolean {
  return Boolean(
    process.env.ATLASSIAN_CLIENT_ID?.trim() &&
      process.env.ATLASSIAN_CLIENT_SECRET?.trim()
  );
}
