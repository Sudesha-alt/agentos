import {
  getGitCredentials,
  getRepoContext,
  type StoredGitCredentials,
} from "../git-integration/gitCredentialsStore";
import { createBitbucketProvider } from "./git/bitbucketProvider";
import { createGithubProvider } from "./git/githubProvider";
import type { GitFileContent, GitProviderClient, GitTreeItem } from "./git/types";

export type { GitFileContent, GitTreeItem, GitProviderId } from "./git/types";

function clientFor(creds: StoredGitCredentials): GitProviderClient {
  if (creds.provider === "bitbucket") {
    const username = creds.username?.trim() || creds.workspace;
    return createBitbucketProvider(username, creds.token);
  }
  return createGithubProvider(creds.token);
}

export function getGitClient(): GitProviderClient {
  return clientFor(getGitCredentials());
}

/** Backward-compatible facade used by indexer, viz, and QA tools. */
export const gitClient = {
  async getRepoTree(branchName: string): Promise<GitTreeItem[]> {
    const ctx = getRepoContext();
    return getGitClient().getRepoTree(ctx, branchName);
  },

  async getFileContent(
    filePath: string,
    branchName: string
  ): Promise<GitFileContent> {
    const ctx = getRepoContext();
    return getGitClient().getFileContent(ctx, filePath, branchName);
  },

  cloneUrl(): string {
    const creds = getGitCredentials();
    const ctx = getRepoContext();
    return clientFor(creds).cloneUrl(ctx);
  },
};
