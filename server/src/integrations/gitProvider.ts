import {
  getGitCredentials,
  getRepoContext,
  resolveGithubAccessToken,
  type StoredGitCredentials,
} from "../git-integration/gitCredentialsStore";
import { createBitbucketProvider } from "./git/bitbucketProvider";
import { createGithubProvider } from "./git/githubProvider";
import type { GitFileContent, GitProviderClient, GitTreeItem } from "./git/types";

export type { GitFileContent, GitTreeItem, GitProviderId, GitPullRequest, GitPushFile } from "./git/types";

function clientFor(creds: StoredGitCredentials): GitProviderClient {
  if (creds.provider === "bitbucket") {
    const username = creds.username?.trim() || creds.workspace;
    return createBitbucketProvider(username, creds.token);
  }
  return createGithubProvider(() => resolveGithubAccessToken(creds));
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

  async cloneUrl(): Promise<string> {
    const creds = getGitCredentials();
    const ctx = getRepoContext();
    return clientFor(creds).cloneUrl(ctx);
  },

  async pushFilesToBranch(
    targetBranch: string,
    sourceBranch: string,
    files: import("./git/types").GitPushFile[],
    commitMessage: string
  ): Promise<{ sha: string }> {
    const ctx = getRepoContext();
    return getGitClient().pushFilesToBranch(ctx, targetBranch, sourceBranch, files, commitMessage);
  },

  async createPullRequest(
    headBranch: string,
    baseBranch: string,
    title: string,
    body: string,
    draft = true
  ): Promise<import("./git/types").GitPullRequest> {
    const ctx = getRepoContext();
    return getGitClient().createPullRequest(ctx, headBranch, baseBranch, title, body, draft);
  },

  async updatePullRequest(
    prNumber: number,
    updates: { title?: string; body?: string; draft?: boolean }
  ): Promise<void> {
    const ctx = getRepoContext();
    return getGitClient().updatePullRequest(ctx, prNumber, updates);
  },
};
