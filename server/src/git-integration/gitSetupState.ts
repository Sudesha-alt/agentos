import type { PublicGitCredentials } from "./gitCredentialsStore";
import {
  getLatestGithubInstallState,
  listStoredRepositories,
} from "./githubInstallationStore";
import { listInstallationRepositories } from "../integrations/git/githubApp";
import { logger } from "../utils/logger";

export type GitIntegrationSetupState = {
  git: PublicGitCredentials;
  connected: boolean;
  needsRepoSelection: boolean;
  availableRepositories: Awaited<ReturnType<typeof listStoredRepositories>>;
  installationDetected: boolean;
};

/** Merge SQLite/runtime creds with Postgres install (source of truth on Render). */
export async function resolveGitIntegrationSetupState(
  git: PublicGitCredentials,
  options?: { orgScoped?: boolean }
): Promise<GitIntegrationSetupState> {
  const pg = options?.orgScoped ? null : await getLatestGithubInstallState();

  const merged: PublicGitCredentials = { ...git };
  if (pg?.installationId) {
    merged.provider = merged.provider ?? "github";
    merged.authMethod = merged.authMethod ?? "github_app";
    merged.installationId = merged.installationId ?? pg.installationId;
    if (pg.selectedRepoOwner && pg.selectedRepoName) {
      merged.workspace = merged.workspace || pg.selectedRepoOwner;
      merged.repoSlug = merged.repoSlug || pg.selectedRepoName;
      merged.configured = Boolean(merged.installationId && merged.workspace && merged.repoSlug);
    }
  }

  const needsRepoSelection = Boolean(
    merged.authMethod === "github_app" &&
      merged.installationId &&
      (!merged.workspace || !merged.repoSlug)
  );

  const connected = Boolean(
    merged.authMethod === "github_app"
      ? merged.installationId && merged.workspace && merged.repoSlug
      : merged.hasToken && merged.workspace && merged.repoSlug
  );

  let availableRepositories: Awaited<ReturnType<typeof listStoredRepositories>> = [];
  if (needsRepoSelection && merged.installationId) {
    try {
      availableRepositories = await listStoredRepositories(merged.installationId);
      if (!availableRepositories.length) {
        availableRepositories = await listInstallationRepositories(merged.installationId);
      }
    } catch (err) {
      logger.warn(
        { err, installationId: merged.installationId },
        "list repos for setup failed"
      );
    }
  }

  return {
    git: merged,
    connected,
    needsRepoSelection,
    availableRepositories,
    installationDetected: Boolean(pg?.installationId ?? merged.installationId),
  };
}
