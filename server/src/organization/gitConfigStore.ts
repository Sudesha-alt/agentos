import { prisma } from "../db/client";
import type { GitAuthMethod, PublicGitCredentials } from "../git-integration/gitCredentialsStore";
import type { GitProviderId } from "../integrations/git/types";

export interface OrganizationGitCredentials {
  provider: GitProviderId;
  workspace: string;
  repoSlug: string;
  username: string | null;
  token: string;
  webhookSecret: string;
  defaultBranch: string;
  installationId: string | null;
  authMethod: GitAuthMethod;
}

function tokenHint(token: string): string | null {
  if (!token || token.length < 8) return null;
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

export async function loadOrganizationGitConfig(
  organizationId: string
): Promise<OrganizationGitCredentials | null> {
  const row = await prisma.organizationGitConfig.findUnique({
    where: { organizationId },
  });
  if (!row) return null;

  return {
    provider: row.provider as GitProviderId,
    workspace: row.workspace,
    repoSlug: row.repoSlug,
    username: row.username,
    token: row.token,
    webhookSecret: row.webhookSecret,
    defaultBranch: row.defaultBranch,
    installationId: row.installationId,
    authMethod: row.authMethod as GitAuthMethod,
  };
}

export async function saveOrganizationGitConfig(
  organizationId: string,
  input: Partial<OrganizationGitCredentials> & { provider?: GitProviderId }
): Promise<OrganizationGitCredentials> {
  const existing = await prisma.organizationGitConfig.findUnique({
    where: { organizationId },
  });

  const creds: OrganizationGitCredentials = {
    provider: input.provider ?? (existing?.provider as GitProviderId) ?? "github",
    workspace: input.workspace?.trim() ?? existing?.workspace ?? "",
    repoSlug: input.repoSlug?.trim() ?? existing?.repoSlug ?? "",
    username:
      input.username !== undefined ? input.username : existing?.username ?? null,
    token: input.token?.trim() || existing?.token || "",
    webhookSecret: input.webhookSecret?.trim() || existing?.webhookSecret || "",
    defaultBranch:
      input.defaultBranch?.trim() || existing?.defaultBranch || "main",
    installationId:
      input.installationId !== undefined
        ? input.installationId
        : existing?.installationId ?? null,
    authMethod:
      input.authMethod ?? (existing?.authMethod as GitAuthMethod) ?? "pat",
  };

  await prisma.organizationGitConfig.upsert({
    where: { organizationId },
    create: {
      organizationId,
      provider: creds.provider,
      workspace: creds.workspace,
      repoSlug: creds.repoSlug,
      username: creds.username,
      token: creds.token,
      webhookSecret: creds.webhookSecret,
      defaultBranch: creds.defaultBranch,
      installationId: creds.installationId,
      authMethod: creds.authMethod,
      updatedAt: new Date(),
    },
    update: {
      provider: creds.provider,
      workspace: creds.workspace,
      repoSlug: creds.repoSlug,
      username: creds.username,
      ...(input.token?.trim() ? { token: creds.token } : {}),
      ...(input.webhookSecret?.trim() ? { webhookSecret: creds.webhookSecret } : {}),
      defaultBranch: creds.defaultBranch,
      installationId: creds.installationId,
      authMethod: creds.authMethod,
      updatedAt: new Date(),
    },
  });

  return creds;
}

export async function getPublicOrganizationGitConfig(
  organizationId: string
): Promise<PublicGitCredentials> {
  const creds = await loadOrganizationGitConfig(organizationId);
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
    hasToken:
      Boolean(creds.token) ||
      (creds.authMethod === "github_app" && Boolean(creds.installationId)),
    tokenHint: creds.token ? tokenHint(creds.token) : null,
    webhookSecret: creds.webhookSecret,
    defaultBranch: creds.defaultBranch,
    configured: connected,
    authMethod: creds.authMethod,
    installationId: creds.installationId,
    source: "database",
  };
}

export async function clearOrganizationGitConfig(organizationId: string): Promise<void> {
  await prisma.organizationGitConfig.deleteMany({ where: { organizationId } });
}

/** Remove all GitHub/Git integration data for a workspace (DB + install + cache). */
export async function purgeOrganizationGitIntegration(
  organizationId: string
): Promise<void> {
  const config = await loadOrganizationGitConfig(organizationId);
  const installationId = config?.installationId ?? null;

  await clearOrganizationGitConfig(organizationId);

  const {
    clearOrganizationGitRuntime,
    activateOrganizationGitContext,
  } = await import("../git-integration/gitCredentialsStore");
  clearOrganizationGitRuntime(organizationId);
  activateOrganizationGitContext(null);

  if (installationId) {
    const { removeGithubInstallation } = await import(
      "../git-integration/githubInstallationStore"
    );
    await removeGithubInstallation(installationId);
  }
}
