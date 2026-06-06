import { enqueueFullIndex } from "../codebaseIntelligence/indexQueue";
import {
  getInstallation,
  getInstallationAccessToken,
  listInstallationRepositories,
  type InstallationRepo,
} from "../integrations/git/githubApp";
import { logger } from "../utils/logger";
import {
  getPublicGitCredentials,
  saveGitCredentials,
  saveGithubAppInstallation,
} from "./gitCredentialsStore";
import {
  listStoredRepositories,
  markSelectedRepository,
  persistInstallationFlow,
} from "./githubInstallationStore";

export async function completeGithubInstallation(installationId: string) {
  const id = installationId.trim();
  if (!id) throw new Error("installationId is required");

  const [meta, repositories] = await Promise.all([
    getInstallation(id),
    listInstallationRepositories(id),
  ]);

  saveGithubAppInstallation(id);

  await persistInstallationFlow({
    installationId: id,
    accountLogin: meta.account.login,
    accountType: meta.account.type,
    targetType: meta.targetType ?? null,
    permissionsJson: meta.permissions ?? null,
    eventsJson: meta.events ?? null,
    suspendedAt: meta.suspendedAt ? new Date(meta.suspendedAt) : null,
    repositories,
  });

  let storedRepos = repositories;
  try {
    const fromDb = await listStoredRepositories(id);
    if (fromDb.length) storedRepos = fromDb;
  } catch {
    // Postgres optional during transition
  }

  return {
    installationId: id,
    accountLogin: meta.account.login,
    accountType: meta.account.type,
    repositories: storedRepos,
    git: getPublicGitCredentials(),
  };
}

export async function selectGithubRepository(input: {
  installationId: string;
  owner: string;
  repo: string;
  defaultBranch?: string;
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

  saveGitCredentials({
    provider: "github",
    workspace: owner,
    repoSlug: repo,
    token,
    authMethod: "github_app",
    installationId,
    defaultBranch,
  });

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

  return {
    connected: true,
    fullName: meta.full_name,
    defaultBranch,
    git: getPublicGitCredentials(),
    indexQueued: Boolean(indexRun),
    indexRunId: indexRun?.runId ?? null,
  };
}

export type { InstallationRepo };
