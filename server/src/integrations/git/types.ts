export type GitProviderId = "github" | "bitbucket";

export interface GitTreeItem {
  path: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
}

export interface GitFileContent {
  path: string;
  sha: string;
  size: number;
  content: string;
}

export interface GitRepoContext {
  provider: GitProviderId;
  workspace: string;
  repoSlug: string;
  defaultBranch: string;
}

export interface GitPushFile {
  filePath: string;
  content: string;
}

export interface GitPullRequest {
  number: number;
  url: string;
  title: string;
  state: string;
  draft: boolean;
}

export interface GitProviderClient {
  readonly provider: GitProviderId;
  testConnection(ctx: GitRepoContext): Promise<{ fullName: string; defaultBranch?: string }>;
  branchExists(ctx: GitRepoContext, branchName: string): Promise<boolean>;
  getRepoTree(ctx: GitRepoContext, branchName: string): Promise<GitTreeItem[]>;
  getFileContent(
    ctx: GitRepoContext,
    filePath: string,
    branchName: string
  ): Promise<GitFileContent>;
  cloneUrl(ctx: GitRepoContext): string | Promise<string>;
  pushFilesToBranch(
    ctx: GitRepoContext,
    targetBranch: string,
    sourceBranch: string,
    files: GitPushFile[],
    commitMessage: string
  ): Promise<{ sha: string }>;
  createPullRequest(
    ctx: GitRepoContext,
    headBranch: string,
    baseBranch: string,
    title: string,
    body: string,
    draft?: boolean
  ): Promise<GitPullRequest>;
  updatePullRequest(
    ctx: GitRepoContext,
    prNumber: number,
    updates: { title?: string; body?: string; draft?: boolean }
  ): Promise<void>;
}
