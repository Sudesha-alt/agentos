import {
  getPublicGitCredentials,
  getRepoContext,
} from "../git-integration/gitCredentialsStore";

export type RepoScope = {
  repoOwner: string;
  repoName: string;
  defaultBranch: string;
  connected: boolean;
};

/** Resolve repo from git credentials store, with env fallback for legacy deploys. */
export function resolveRepoScope(): RepoScope | null {
  const publicCreds = getPublicGitCredentials();
  if (publicCreds.configured && publicCreds.workspace && publicCreds.repoSlug) {
    return {
      repoOwner: publicCreds.workspace,
      repoName: publicCreds.repoSlug,
      defaultBranch: publicCreds.defaultBranch ?? "main",
      connected: true,
    };
  }

  try {
    const ctx = getRepoContext();
    if (ctx.workspace && ctx.repoSlug) {
      return {
        repoOwner: ctx.workspace,
        repoName: ctx.repoSlug,
        defaultBranch: ctx.defaultBranch ?? "main",
        connected: true,
      };
    }
  } catch {
    /* fall through */
  }

  const repoOwner = process.env.GITHUB_REPO_OWNER?.trim() ?? "";
  const repoName = process.env.GITHUB_REPO_NAME?.trim() ?? "";
  if (repoOwner && repoName) {
    return {
      repoOwner,
      repoName,
      defaultBranch: process.env.GITHUB_DEFAULT_BRANCH?.trim() ?? "main",
      connected: false,
    };
  }

  return null;
}

export function requireRepoScope(): RepoScope {
  const scope = resolveRepoScope();
  if (!scope?.repoOwner || !scope.repoName) {
    throw new Error("Repository not configured — connect GitHub and select a repo.");
  }
  return scope;
}
