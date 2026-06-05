/**
 * @deprecated Use `gitClient` from `./gitProvider` — kept for incremental migration.
 */
import { gitClient } from "./gitProvider";

export type { GitTreeItem } from "./git/types";

export const githubClient = {
  getRepoTree: (branchName: string) => gitClient.getRepoTree(branchName),
  getFileContent: (filePath: string, branchName: string) =>
    gitClient.getFileContent(filePath, branchName),
};
