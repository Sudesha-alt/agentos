import { enqueueFullIndex } from "../codebaseIntelligence/indexQueue";

/** GitHub App webhooks should subscribe to `push` and `pull_request` (merged) events. */
import {
  getInstallation,
  getInstallationAccessToken,
  listInstallationRepositories,
  type InstallationRepo,
} from "../integrations/git/githubApp";
import {
  getPublicOrganizationGitConfig,
  saveOrganizationGitConfig,
} from "../organization/gitConfigStore";
import { logger } from "../utils/logger";
import {
  getPublicGitCredentials,
  saveGithubAppInstallation,
  saveGitCredentialsForOrganization,
} from "./gitCredentialsStore";
import {
  listStoredRepositories,
  markSelectedRepository,
  persistInstallationFlow,
} from "./githubInstallationStore";

export async function completeGithubInstallation(
  installationId: string,
  organizationId?: string
) {
  const id = installationId.trim();
  if (!id) throw new Error("installationId is required");

  const [meta, repositories] = await Promise.all([
    getInstallation(id),
    listInstallationRepositories(id),
  ]);

  const canonicalId = String(meta.id ?? id);

  if (organizationId) {
    await saveGitCredentialsForOrganization(organizationId, {
      provider: "github",
      authMethod: "github_app",
      installationId: canonicalId,
      workspace: meta.account.login,
      repoSlug: "",
    });
  } else {
    saveGithubAppInstallation(canonicalId);
  }

  await persistInstallationFlow({
    installationId: canonicalId,
    accountLogin: meta.account.login,
    accountType: meta.account.type,
    targetType: meta.targetType ?? null,
    permissionsJson: meta.permissions ?? null,
    eventsJson: meta.events ?? null,
    suspendedAt: meta.suspendedAt ? new Date(meta.suspendedAt) : null,
    repositories,
    organizationId: organizationId ?? null,
  });

  let storedRepos = repositories;
  try {
    const fromDb = await listStoredRepositories(canonicalId);
    if (fromDb.length) storedRepos = fromDb;
  } catch {
    // Postgres optional during transition
  }

  const git = organizationId
    ? await getPublicOrganizationGitConfig(organizationId)
    : getPublicGitCredentials();
  let autoSelected: Awaited<ReturnType<typeof selectGithubRepository>> | null = null;
  if (storedRepos.length === 1 && (!git.workspace || !git.repoSlug)) {
    const only = storedRepos[0]!;
    try {
      autoSelected = await selectGithubRepository({
        installationId: canonicalId,
        owner: only.owner,
        repo: only.name,
        defaultBranch: only.defaultBranch,
        organizationId,
      });
    } catch (err) {
      logger.warn(
        { err, installationId: canonicalId, repo: only.fullName },
        "auto-select single repo failed"
      );
    }
  }

  const resolvedGit = organizationId
    ? await getPublicOrganizationGitConfig(organizationId)
    : autoSelected?.git ?? getPublicGitCredentials();

  return {
    installationId: canonicalId,
    accountLogin: meta.account.login,
    accountType: meta.account.type,
    repositories: storedRepos,
    git: resolvedGit,
    autoSelected: autoSelected
      ? {
          fullName: autoSelected.fullName,
          indexRunId: autoSelected.indexRunId,
        }
      : null,
  };
}

export async function selectGithubRepository(input: {
  installationId: string;
  owner: string;
  repo: string;
  defaultBranch?: string;
  organizationId?: string;
}) {
  const installationId = input.installationId.trim();
  const owner = input.owner.trim();
  const repo = input.repo.trim();
  if (!installationId || !owner || !repo) {
    throw new Error("installationId, owner, and repo are required");
  }

  const token = await getInstallationAccessToken(installationId);
  const repoRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );
  if (!repoRes.ok) {
    throw new Error(`GitHub repo lookup failed: ${repoRes.status}`);
  }
  const meta = (await repoRes.json()) as {
    full_name: string;
    default_branch?: string;
  };

  const defaultBranch =
    input.defaultBranch?.trim() || meta.default_branch || "main";

  if (input.organizationId) {
    await saveGitCredentialsForOrganization(input.organizationId, {
      provider: "github",
      workspace: owner,
      repoSlug: repo,
      token,
      authMethod: "github_app",
      installationId,
      defaultBranch,
    });
  } else {
    const { saveGitCredentials } = await import("./gitCredentialsStore");
    saveGitCredentials({
      provider: "github",
      workspace: owner,
      repoSlug: repo,
      token,
      authMethod: "github_app",
      installationId,
      defaultBranch,
    });
  }

  try {
    await markSelectedRepository({ installationId, owner, repo });
  } catch (err) {
    logger.warn({ err, installationId, owner, repo }, "mark selected repo in postgres failed");
  }

  let indexRun: { runId: string; queued: boolean } | null = null;
  try {
    indexRun = await enqueueFullIndex(defaultBranch, "manual");
  } catch (err) {
    logger.warn({ err, owner, repo, defaultBranch }, "initial codebase index enqueue failed");
  }

  const git = input.organizationId
    ? await getPublicOrganizationGitConfig(input.organizationId)
    : getPublicGitCredentials();

  return {
    connected: true,
    fullName: meta.full_name,
    defaultBranch,
    git,
    indexQueued: Boolean(indexRun),
    indexRunId: indexRun?.runId ?? null,
  };
}

export type { InstallationRepo };
