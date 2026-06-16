import { prisma } from "../db/client";
import { loadOrganizationGitConfig } from "../organization/gitConfigStore";
import { logger } from "../utils/logger";
import { completeGithubInstallation } from "./githubInstall";

const prismaAny = prisma as any;
const ORPHAN_REPAIR_MAX_AGE_MS = 48 * 60 * 60 * 1000;

/**
 * Bind an orphan GitHub App install to the AgentOS organization when OAuth state
 * was lost, or ensure Postgres install rows match org git config.
 */
export async function repairOrganizationGithubInstall(
  organizationId: string
): Promise<boolean> {
  const config = await loadOrganizationGitConfig(organizationId);

  if (config?.installationId) {
    const updated = await prismaAny.githubInstallation.updateMany({
      where: {
        installationId: config.installationId,
        OR: [{ organizationId: null }, { organizationId }],
      },
      data: { organizationId },
    });
    if (updated.count > 0) {
      logger.info(
        {
          organizationId,
          installationId: config.installationId,
          count: updated.count,
        },
        "repaired github installation org binding for existing config"
      );
    }
    return false;
  }

  if (!process.env.DATABASE_URL?.trim()) {
    return false;
  }

  const orphan = (await prismaAny.githubInstallation.findFirst({
    where: { organizationId: null },
    orderBy: { updatedAt: "desc" },
    select: {
      installationId: true,
      updatedAt: true,
      accountLogin: true,
    },
  })) as {
    installationId: string;
    updatedAt: Date;
    accountLogin: string;
  } | null;

  if (!orphan) {
    return false;
  }

  const ageMs = Date.now() - orphan.updatedAt.getTime();
  if (ageMs > ORPHAN_REPAIR_MAX_AGE_MS) {
    logger.info(
      {
        organizationId,
        installationId: orphan.installationId,
        ageHours: Math.round(ageMs / 3_600_000),
      },
      "skipped orphan github install repair — too old"
    );
    return false;
  }

  logger.info(
    {
      organizationId,
      installationId: orphan.installationId,
      accountLogin: orphan.accountLogin,
    },
    "repairing orphan github install for organization"
  );

  await completeGithubInstallation(orphan.installationId, organizationId);
  return true;
}
