import { getGitClient } from "../integrations/gitProvider";
import { getActiveOrganizationId } from "../organization/context";
import { logger } from "../utils/logger";
import {
  getGitCredentials,
  getRepoContext,
  saveGitCredentialsForOrganization,
} from "./gitCredentialsStore";

/** Pick a branch that exists on the remote; prefer GitHub/Bitbucket default when stored branch is stale. */
export async function resolveRepoIndexBranch(
  preferredBranch?: string
): Promise<string> {
  const ctx = getRepoContext();
  const client = getGitClient();
  const meta = await client.testConnection(ctx);
  const remoteDefault = meta.defaultBranch?.trim() || "main";
  const preferred =
    preferredBranch?.trim() || ctx.defaultBranch?.trim() || remoteDefault;

  if (preferred === remoteDefault) {
    return remoteDefault;
  }

  const exists = await client.branchExists(ctx, preferred);
  if (exists) {
    return preferred;
  }

  logger.warn(
    {
      preferred,
      remoteDefault,
      repo: `${ctx.workspace}/${ctx.repoSlug}`,
    },
    "git branch missing on remote — using repository default branch for index"
  );

  const orgId = getActiveOrganizationId();
  if (orgId) {
    const creds = getGitCredentials();
    try {
      await saveGitCredentialsForOrganization(orgId, {
        provider: creds.provider,
        workspace: creds.workspace,
        repoSlug: creds.repoSlug,
        username: creds.username,
        token: creds.token || undefined,
        webhookSecret: creds.webhookSecret || undefined,
        defaultBranch: remoteDefault,
        installationId: creds.installationId,
        authMethod: creds.authMethod,
      });
    } catch (err) {
      logger.warn({ err, orgId, remoteDefault }, "could not persist corrected default branch");
    }
  }

  return remoteDefault;
}
