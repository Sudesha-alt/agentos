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

export interface GitProviderClient {
  readonly provider: GitProviderId;
  testConnection(ctx: GitRepoContext): Promise<{ fullName: string; defaultBranch?: string }>;
  getRepoTree(ctx: GitRepoContext, branchName: string): Promise<GitTreeItem[]>;
  getFileContent(
    ctx: GitRepoContext,
    filePath: string,
    branchName: string
  ): Promise<GitFileContent>;
  cloneUrl(ctx: GitRepoContext): string | Promise<string>;
}
