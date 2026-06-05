import { Buffer } from "node:buffer";
import { retry } from "../../utils/retry";
import type {
  GitFileContent,
  GitProviderClient,
  GitRepoContext,
  GitTreeItem,
} from "./types";

const API_BASE = "https://api.github.com";

function createFetch(token: string) {
  return async function githubFetch<T>(path: string): Promise<T> {
    return retry(async () => {
      const res = await fetch(`${API_BASE}${path}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });
      if (!res.ok) {
        throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
      }
      return (await res.json()) as T;
    });
  };
}

export function createGithubProvider(token: string): GitProviderClient {
  const githubFetch = createFetch(token);

  return {
    provider: "github",

    async testConnection(ctx) {
      const data = await githubFetch<{ full_name: string; default_branch?: string }>(
        `/repos/${ctx.workspace}/${ctx.repoSlug}`
      );
      return { fullName: data.full_name, defaultBranch: data.default_branch };
    },

    async getRepoTree(ctx, branchName) {
      const refData = await githubFetch<{ object: { sha: string } }>(
        `/repos/${ctx.workspace}/${ctx.repoSlug}/git/ref/heads/${encodeURIComponent(branchName)}`
      );
      const treeData = await githubFetch<{
        tree: Array<{ path: string; type: string; sha: string; size?: number }>;
      }>(
        `/repos/${ctx.workspace}/${ctx.repoSlug}/git/trees/${refData.object.sha}?recursive=1`
      );
      return treeData.tree.map(
        (item): GitTreeItem => ({
          path: item.path,
          type: item.type === "tree" ? "tree" : "blob",
          sha: item.sha,
          size: item.size,
        })
      );
    },

    async getFileContent(ctx, filePath, branchName) {
      const data = await githubFetch<{
        path: string;
        sha: string;
        size: number;
        content: string;
        encoding: string;
      }>(
        `/repos/${ctx.workspace}/${ctx.repoSlug}/contents/${filePath}?ref=${encodeURIComponent(
          branchName
        )}`
      );
      if (data.encoding !== "base64") {
        throw new Error(`Unsupported encoding for ${filePath}: ${data.encoding}`);
      }
      return {
        path: data.path,
        sha: data.sha,
        size: data.size,
        content: Buffer.from(data.content, "base64").toString("utf8"),
      } satisfies GitFileContent;
    },

    cloneUrl(ctx) {
      return `https://${encodeURIComponent(token)}@github.com/${ctx.workspace}/${ctx.repoSlug}.git`;
    },
  };
}
