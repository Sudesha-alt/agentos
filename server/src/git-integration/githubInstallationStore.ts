import { prisma } from "../db/client";
import type { InstallationRepo } from "../integrations/git/githubApp";
import { logger } from "../utils/logger";

const prismaAny = prisma as any;

export type GithubInstallationRecord = {
  installationId: string;
  accountLogin: string;
  accountType: string;
  targetType: string | null;
  permissionsJson: unknown;
  eventsJson: unknown;
  suspendedAt: Date | null;
  selectedRepoOwner: string | null;
  selectedRepoName: string | null;
};

export async function upsertGithubInstallation(input: {
  installationId: string;
  accountLogin: string;
  accountType: string;
  targetType?: string | null;
  permissionsJson?: unknown;
  eventsJson?: unknown;
  suspendedAt?: Date | null;
  organizationId?: string | null;
}): Promise<GithubInstallationRecord> {
  const row = await prismaAny.githubInstallation.upsert({
    where: { installationId: input.installationId },
    create: {
      installationId: input.installationId,
      accountLogin: input.accountLogin,
      accountType: input.accountType,
      targetType: input.targetType ?? null,
      permissionsJson: input.permissionsJson ?? null,
      eventsJson: input.eventsJson ?? null,
      suspendedAt: input.suspendedAt ?? null,
      organizationId: input.organizationId ?? null,
    },
    update: {
      accountLogin: input.accountLogin,
      accountType: input.accountType,
      targetType: input.targetType ?? null,
      permissionsJson: input.permissionsJson ?? null,
      eventsJson: input.eventsJson ?? null,
      suspendedAt: input.suspendedAt ?? null,
      ...(input.organizationId !== undefined
        ? { organizationId: input.organizationId }
        : {}),
    },
  });
  return row as GithubInstallationRecord;
}

export async function syncInstallationRepositories(
  installationId: string,
  repositories: InstallationRepo[]
): Promise<void> {
  const existing = (await prismaAny.githubRepository.findMany({
    where: { installationId },
    select: { githubRepoId: true, selected: true },
  })) as Array<{ githubRepoId: number; selected: boolean }>;

  const selectedIds = new Set(
    existing.filter((row) => row.selected).map((row) => row.githubRepoId)
  );
  const incomingIds = new Set(repositories.map((repo) => repo.id));

  for (const repo of repositories) {
    await prismaAny.githubRepository.upsert({
      where: {
        installationId_githubRepoId: {
          installationId,
          githubRepoId: repo.id,
        },
      },
      create: {
        installationId,
        githubRepoId: repo.id,
        owner: repo.owner,
        name: repo.name,
        fullName: repo.fullName,
        defaultBranch: repo.defaultBranch,
        private: repo.private,
        selected: selectedIds.has(repo.id),
      },
      update: {
        owner: repo.owner,
        name: repo.name,
        fullName: repo.fullName,
        defaultBranch: repo.defaultBranch,
        private: repo.private,
      },
    });
  }

  const staleIds = existing
    .map((row) => row.githubRepoId)
    .filter((id) => !incomingIds.has(id));
  if (staleIds.length) {
    await prismaAny.githubRepository.deleteMany({
      where: { installationId, githubRepoId: { in: staleIds } },
    });
  }
}

export async function markSelectedRepository(input: {
  installationId: string;
  owner: string;
  repo: string;
}): Promise<void> {
  await prismaAny.githubRepository.updateMany({
    where: { installationId: input.installationId },
    data: { selected: false },
  });
  await prismaAny.githubRepository.updateMany({
    where: {
      installationId: input.installationId,
      owner: input.owner,
      name: input.repo,
    },
    data: { selected: true },
  });
  await prismaAny.githubInstallation.update({
    where: { installationId: input.installationId },
    data: {
      selectedRepoOwner: input.owner,
      selectedRepoName: input.repo,
    },
  });
}

export async function listStoredRepositories(
  installationId: string
): Promise<InstallationRepo[]> {
  const rows = (await prismaAny.githubRepository.findMany({
    where: { installationId },
    orderBy: { fullName: "asc" },
  })) as Array<{
    githubRepoId: number;
    fullName: string;
    owner: string;
    name: string;
    defaultBranch: string;
    private: boolean;
  }>;

  return rows.map((row) => ({
    id: row.githubRepoId,
    fullName: row.fullName,
    owner: row.owner,
    name: row.name,
    defaultBranch: row.defaultBranch,
    private: row.private,
  }));
}

export type GithubInstallState = {
  installationId: string;
  accountLogin: string;
  selectedRepoOwner: string | null;
  selectedRepoName: string | null;
  updatedAt: Date;
};

/** Latest GitHub App install from Postgres (survives Render SQLite resets). */
export async function getLatestGithubInstallState(): Promise<GithubInstallState | null> {
  try {
    const row = (await prismaAny.githubInstallation.findFirst({
      orderBy: { updatedAt: "desc" },
      select: {
        installationId: true,
        accountLogin: true,
        selectedRepoOwner: true,
        selectedRepoName: true,
        updatedAt: true,
      },
    })) as GithubInstallState | null;
    return row;
  } catch (err) {
    logger.warn({ err }, "read github installation from postgres failed");
    return null;
  }
}

export async function getGithubInstallByInstallationId(
  installationId: string
): Promise<GithubInstallState | null> {
  try {
    const row = (await prismaAny.githubInstallation.findUnique({
      where: { installationId },
      select: {
        installationId: true,
        accountLogin: true,
        selectedRepoOwner: true,
        selectedRepoName: true,
        updatedAt: true,
      },
    })) as GithubInstallState | null;
    return row;
  } catch (err) {
    logger.warn({ err, installationId }, "read github installation by id failed");
    return null;
  }
}

export async function getGithubInstallForOrganization(
  organizationId: string
): Promise<GithubInstallState | null> {
  try {
    const row = (await prismaAny.githubInstallation.findFirst({
      where: { organizationId },
      orderBy: { updatedAt: "desc" },
      select: {
        installationId: true,
        accountLogin: true,
        selectedRepoOwner: true,
        selectedRepoName: true,
        updatedAt: true,
      },
    })) as GithubInstallState | null;
    return row;
  } catch (err) {
    logger.warn({ err, organizationId }, "read github installation for org failed");
    return null;
  }
}

export async function unlinkGithubInstallationFromOrganization(
  organizationId: string
): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) return;
  await prismaAny.githubInstallation.updateMany({
    where: { organizationId },
    data: { organizationId: null },
  });
}

export async function removeGithubInstallation(installationId: string): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) return;
  await prismaAny.githubInstallation.deleteMany({
    where: { installationId },
  });
}

export async function persistInstallationFlow(input: {
  installationId: string;
  accountLogin: string;
  accountType: string;
  targetType?: string | null;
  permissionsJson?: unknown;
  eventsJson?: unknown;
  suspendedAt?: Date | null;
  repositories: InstallationRepo[];
  organizationId?: string | null;
}): Promise<void> {
  if (!process.env.DATABASE_URL?.trim()) {
    logger.warn(
      { installationId: input.installationId },
      "DATABASE_URL not set — skipping Postgres github install persist"
    );
    return;
  }

  await upsertGithubInstallation({
    installationId: input.installationId,
    accountLogin: input.accountLogin,
    accountType: input.accountType,
    targetType: input.targetType,
    permissionsJson: input.permissionsJson,
    eventsJson: input.eventsJson,
    suspendedAt: input.suspendedAt,
    organizationId: input.organizationId ?? null,
  });
  await syncInstallationRepositories(input.installationId, input.repositories);
}
