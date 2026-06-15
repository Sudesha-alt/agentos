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
