import { createBitbucketProvider } from "../integrations/git/bitbucketProvider";
import { createGithubProvider } from "../integrations/git/githubProvider";
import type { GitProviderId } from "../integrations/git/types";
import { getPublicOrganizationGitConfig, saveOrganizationGitConfig } from "../organization/gitConfigStore";
import {
  getPublicGitCredentials,
  loadGitCredentialsFromStore,
  saveGitCredentials,
  type StoredGitCredentials,
} from "./gitCredentialsStore";

export async function connectGit(input: {
  provider: GitProviderId;
  workspace: string;
  repoSlug: string;
  username?: string;
  token?: string;
  webhookSecret?: string;
  defaultBranch?: string;
  organizationId?: string;
}) {
  const prior = input.organizationId
    ? await getPublicOrganizationGitConfig(input.organizationId)
    : getPublicGitCredentials();
  const stored = loadGitCredentialsFromStore();
  const token = input.token?.trim() || stored?.token || "";
  if (!token) {
    throw new Error("token is required on first connect");
  }

  if (input.provider === "bitbucket" && !input.username?.trim() && !prior.username) {
    throw new Error("username is required for Bitbucket (Atlassian account email)");
  }

  const draft: StoredGitCredentials = {
    provider: input.provider,
    workspace: input.workspace.trim(),
    repoSlug: input.repoSlug.trim(),
    username: input.username?.trim() || prior.username || null,
    token: token || "",
    webhookSecret: input.webhookSecret?.trim() ?? prior.webhookSecret ?? "",
    defaultBranch: input.defaultBranch?.trim() || prior.defaultBranch || "main",
    installationId: prior.installationId ?? null,
    authMethod: "pat",
    source: "database",
  };

  const ctx = {
    provider: draft.provider,
    workspace: draft.workspace,
    repoSlug: draft.repoSlug,
    defaultBranch: draft.defaultBranch,
  };

  const client =
    draft.provider === "bitbucket"
      ? createBitbucketProvider(draft.username ?? draft.workspace, draft.token)
      : createGithubProvider(() => Promise.resolve(draft.token));

  const meta = await client.testConnection(ctx);
  let defaultBranch =
    meta.defaultBranch?.trim() || input.defaultBranch?.trim() || draft.defaultBranch;
  if (input.defaultBranch?.trim() && meta.defaultBranch) {
    const exists = await client.branchExists(ctx, input.defaultBranch.trim());
    if (!exists) {
      defaultBranch = meta.defaultBranch.trim();
    }
  }

  if (input.organizationId) {
    await saveOrganizationGitConfig(input.organizationId, {
      provider: input.provider,
      workspace: draft.workspace,
      repoSlug: draft.repoSlug,
      username: draft.username,
      token: draft.token,
      webhookSecret: draft.webhookSecret,
      defaultBranch,
      authMethod: "pat",
    });
    const git = await getPublicOrganizationGitConfig(input.organizationId);
    return { connected: true, git };
  }

  saveGitCredentials({
    provider: input.provider,
    workspace: draft.workspace,
    repoSlug: draft.repoSlug,
    username: draft.username,
    token: draft.token,
    webhookSecret: draft.webhookSecret,
    defaultBranch,
    authMethod: "pat",
  });

  return {
    connected: true,
    git: getPublicGitCredentials(),
  };
}
