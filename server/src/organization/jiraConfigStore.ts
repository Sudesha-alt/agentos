import { prisma } from "../db/client";
import type { PipelineJiraCredentials } from "../pipeline/jira/credentialsStore";

function parseProjectKeys(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String).filter(Boolean);
}

export async function loadOrganizationJiraConfig(
  organizationId: string
): Promise<PipelineJiraCredentials | null> {
  const row = await prisma.organizationJiraConfig.findUnique({
    where: { organizationId },
  });
  if (!row) return null;

  return {
    baseUrl: row.baseUrl.replace(/\/+$/, ""),
    email: row.email,
    apiToken: row.apiToken,
    webhookSecret: row.webhookSecret,
    projectKeys: parseProjectKeys(row.projectKeysJson),
  };
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
  }
): Promise<PipelineJiraCredentials> {
  const existing = await prisma.organizationJiraConfig.findUnique({
    where: { organizationId },
  });

  const apiToken = input.apiToken?.trim() || existing?.apiToken || "";
  const webhookSecret =
    input.webhookSecret?.trim() || existing?.webhookSecret || "";

  const creds: PipelineJiraCredentials = {
    baseUrl: input.baseUrl.replace(/\/+$/, ""),
    email: input.email.trim(),
    apiToken,
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
      webhookSecret: creds.webhookSecret,
      projectKeysJson: creds.projectKeys,
      boardId: input.boardId?.trim() || existing?.boardId || null,
      updatedAt: new Date(),
    },
    update: {
      baseUrl: creds.baseUrl,
      email: creds.email,
      ...(input.apiToken?.trim() ? { apiToken: creds.apiToken } : {}),
      ...(input.webhookSecret?.trim() ? { webhookSecret: creds.webhookSecret } : {}),
      ...(input.projectKeys?.length ? { projectKeysJson: creds.projectKeys } : {}),
      ...(input.boardId?.trim() ? { boardId: input.boardId.trim() } : {}),
      updatedAt: new Date(),
    },
  });

  return creds;
}

export async function getPublicOrganizationJiraConfig(organizationId: string) {
  const creds = await loadOrganizationJiraConfig(organizationId);
  if (!creds) {
    return {
      baseUrl: "",
      email: "",
      hasApiToken: false,
      tokenHint: null,
      webhookSecret: "",
      projectKeys: [],
      configured: false,
      source: "none" as const,
    };
  }

  const tokenHint =
    creds.apiToken && creds.apiToken.length >= 4
      ? `••••${creds.apiToken.slice(-4)}`
      : null;

  return {
    baseUrl: creds.baseUrl,
    email: creds.email,
    hasApiToken: Boolean(creds.apiToken),
    tokenHint,
    webhookSecret: creds.webhookSecret,
    projectKeys: creds.projectKeys,
    configured: Boolean(creds.baseUrl && creds.email && creds.apiToken),
    source: "database" as const,
  };
}
