import { prisma } from "../db/client";

export async function resolveOrganizationByJiraWebhookSecret(
  secret: string
): Promise<string | null> {
  if (!secret.trim()) return null;
  const row = await prisma.organizationJiraConfig.findFirst({
    where: { webhookSecret: secret },
    select: { organizationId: true },
  });
  return row?.organizationId ?? null;
}

export async function resolveOrganizationByGithubInstallation(
  installationId: string
): Promise<string | null> {
  if (!installationId.trim()) return null;

  const fromGitConfig = await prisma.organizationGitConfig.findFirst({
    where: { installationId },
    select: { organizationId: true },
  });
  if (fromGitConfig?.organizationId) return fromGitConfig.organizationId;

  const install = await prisma.githubInstallation.findUnique({
    where: { installationId },
    select: { organizationId: true },
  });
  return install?.organizationId ?? null;
}

export async function resolveOrganizationByGitWebhookSecret(
  provider: "github" | "bitbucket",
  secret: string
): Promise<string | null> {
  if (!secret.trim()) return null;
  const row = await prisma.organizationGitConfig.findFirst({
    where: { webhookSecret: secret, provider },
    select: { organizationId: true },
  });
  return row?.organizationId ?? null;
}

function parseProjectKeysJson(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(String).filter(Boolean);
}

/** PROJ-123 → PROJ */
export function projectKeyFromIssueKey(jiraKey: string | undefined): string | null {
  if (!jiraKey?.trim()) return null;
  const dash = jiraKey.lastIndexOf("-");
  if (dash <= 0) return null;
  return jiraKey.slice(0, dash).trim().toUpperCase();
}

/** Match org by Jira project key (OAuth dynamic webhooks share one app client secret). */
export async function resolveOrganizationByJiraProjectKey(
  projectKey: string
): Promise<string | null> {
  const normalized = projectKey.trim().toUpperCase();
  if (!normalized) return null;

  const rows = await prisma.organizationJiraConfig.findMany({
    select: { organizationId: true, projectKeysJson: true },
  });

  for (const row of rows) {
    const keys = parseProjectKeysJson(row.projectKeysJson);
    if (keys.length === 0) continue;
    if (keys.some((k) => k.trim().toUpperCase() === normalized)) {
      return row.organizationId;
    }
  }

  const connected = await listOrganizationIdsWithJiraConfig();
  if (connected.length === 1) return connected[0]!;
  return null;
}

export async function listOrganizationIdsWithJiraConfig(): Promise<string[]> {
  const rows = await prisma.organizationJiraConfig.findMany({
    where: {
      OR: [
        {
          baseUrl: { not: "" },
          email: { not: "" },
          apiToken: { not: "" },
        },
        {
          authMethod: "oauth",
          cloudId: { not: null },
          accessToken: { not: "" },
        },
      ],
    },
    select: { organizationId: true },
  });
  return rows.map((r) => r.organizationId);
}
