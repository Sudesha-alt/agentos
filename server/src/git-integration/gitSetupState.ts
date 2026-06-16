import type { PublicGitCredentials } from "./gitCredentialsStore";
import {
  getGithubInstallByInstallationId,
  getGithubInstallForOrganization,
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
  accountLogin: string | null;
};

/** Merge org git config with Postgres GitHub App install metadata. */
export async function resolveGitIntegrationSetupState(
  git: PublicGitCredentials,
  options?: { orgScoped?: boolean; organizationId?: string }
): Promise<GitIntegrationSetupState> {
  const merged: PublicGitCredentials = { ...git };
  let pg = null as Awaited<ReturnType<typeof getLatestGithubInstallState>>;

  if (options?.orgScoped && options.organizationId) {
    if (merged.installationId) {
      pg = await getGithubInstallByInstallationId(merged.installationId);
    }
    if (!pg) {
      pg = await getGithubInstallForOrganization(options.organizationId);
    }
    if (pg?.installationId) {
      merged.provider = merged.provider ?? "github";
      merged.authMethod = merged.authMethod ?? "github_app";
      merged.installationId = merged.installationId ?? pg.installationId;
      merged.workspace = merged.workspace || pg.accountLogin;
      if (pg.selectedRepoOwner && pg.selectedRepoName) {
        merged.repoSlug = merged.repoSlug || pg.selectedRepoName;
        merged.workspace = merged.workspace || pg.selectedRepoOwner;
      }
      merged.configured = Boolean(
        merged.installationId && merged.workspace && merged.repoSlug
      );
    }
  } else if (!options?.orgScoped) {
    pg = await getLatestGithubInstallState();
    if (pg?.installationId) {
      merged.provider = merged.provider ?? "github";
      merged.authMethod = merged.authMethod ?? "github_app";
      merged.installationId = merged.installationId ?? pg.installationId;
      if (pg.selectedRepoOwner && pg.selectedRepoName) {
        merged.workspace = merged.workspace || pg.selectedRepoOwner;
        merged.repoSlug = merged.repoSlug || pg.selectedRepoName;
        merged.configured = Boolean(
          merged.installationId && merged.workspace && merged.repoSlug
        );
      }
    }
  }

  const needsRepoSelection = Boolean(
    merged.authMethod === "github_app" &&
      merged.installationId &&
      !merged.repoSlug
  );

  const connected = Boolean(
    merged.authMethod === "github_app"
      ? merged.installationId && merged.workspace && merged.repoSlug
      : merged.hasToken && merged.workspace && merged.repoSlug
  );

  let availableRepositories: Awaited<ReturnType<typeof listStoredRepositories>> = [];
  const shouldListRepos = Boolean(
    merged.installationId && (needsRepoSelection || !connected)
  );
  if (shouldListRepos && merged.installationId) {
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
    accountLogin: pg?.accountLogin ?? (merged.workspace || null),
  };
}
