import {
  getPublicGitCredentials,
  getRepoContext,
} from "../git-integration/gitCredentialsStore";
import { getActiveOrganizationId } from "../organization/context";

export type RepoScope = {
  repoOwner: string;
  repoName: string;
  defaultBranch: string;
  connected: boolean;
  organizationId: string;
};

/** Resolve repo from org-scoped git credentials, with env fallback for legacy deploys. */
export function resolveRepoScope(): RepoScope | null {
  const organizationId = getActiveOrganizationId();
  if (!organizationId) return null;
  const publicCreds = getPublicGitCredentials();
  if (publicCreds.configured && publicCreds.workspace && publicCreds.repoSlug) {
    return {
      repoOwner: publicCreds.workspace,
      repoName: publicCreds.repoSlug,
      defaultBranch: publicCreds.defaultBranch ?? "main",
      connected: true,
      organizationId,
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
        organizationId,
      };
    }
  } catch {
    /* fall through */
  }

  return null;
}

export function requireRepoScope(): RepoScope {
  const scope = resolveRepoScope();
  if (!scope?.repoOwner || !scope.repoName || !scope.organizationId) {
    throw new Error("Repository not configured — connect GitHub and select a repo.");
  }
  return scope;
}

export function codebaseOrgWhere(
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  const organizationId = getActiveOrganizationId();
  if (!organizationId) {
    throw new Error("organization_context_required");
  }
  return { organizationId, ...extra };
}
