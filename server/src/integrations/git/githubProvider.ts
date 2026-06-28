import { Buffer } from "node:buffer";
import { retry } from "../../utils/retry";
import { normalizePushFiles } from "./normalizePushFiles";
import type {
  GitFileContent,
  GitProviderClient,
  GitPullRequest,
  GitPushFile,
  GitRepoContext,
  GitTreeItem,
} from "./types";

const API_BASE = "https://api.github.com";

export function createGithubProvider(
  getToken: () => Promise<string>
): GitProviderClient {
  async function githubFetch<T>(path: string): Promise<T> {
    return retry(async () => {
      const token = await getToken();
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
  }

  async function githubPost<T>(path: string, body: unknown): Promise<T> {
    return retry(async () => {
      const token = await getToken();
      const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(`GitHub API POST ${res.status}: ${await res.text()}`);
      }
      return (await res.json()) as T;
    });
  }

  async function githubPatch<T>(path: string, body: unknown): Promise<T> {
    return retry(async () => {
      const token = await getToken();
      const res = await fetch(`${API_BASE}${path}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error(`GitHub API PATCH ${res.status}: ${await res.text()}`);
      }
      return (await res.json()) as T;
    });
  }

  return {
    provider: "github",

    async testConnection(ctx) {
      const data = await githubFetch<{ full_name: string; default_branch?: string }>(
        `/repos/${ctx.workspace}/${ctx.repoSlug}`
      );
      return { fullName: data.full_name, defaultBranch: data.default_branch };
    },

    async branchExists(ctx, branchName) {
      try {
        const token = await getToken();
        const res = await fetch(
          `${API_BASE}/repos/${ctx.workspace}/${ctx.repoSlug}/git/ref/heads/${encodeURIComponent(branchName)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
            },
          }
        );
        return res.ok;
      } catch {
        return false;
      }
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

    async cloneUrl(ctx) {
      const token = await getToken();
      return `https://x-access-token:${encodeURIComponent(token)}@github.com/${ctx.workspace}/${ctx.repoSlug}.git`;
    },

    async pushFilesToBranch(ctx, targetBranch, sourceBranch, files, commitMessage) {
      const pushFiles = normalizePushFiles(files);

      // Get the source branch tip SHA to use as the base commit
      const refData = await githubFetch<{ object: { sha: string } }>(
        `/repos/${ctx.workspace}/${ctx.repoSlug}/git/ref/heads/${encodeURIComponent(sourceBranch)}`
      );
      const baseSha = refData.object.sha;

      // Ensure the target branch exists; create it from source if not
      let targetSha: string;
      try {
        const targetRef = await githubFetch<{ object: { sha: string } }>(
          `/repos/${ctx.workspace}/${ctx.repoSlug}/git/ref/heads/${encodeURIComponent(targetBranch)}`
        );
        targetSha = targetRef.object.sha;
      } catch {
        // Branch doesn't exist — create it from source
        const created = await githubPost<{ object: { sha: string } }>(
          `/repos/${ctx.workspace}/${ctx.repoSlug}/git/refs`,
          { ref: `refs/heads/${targetBranch}`, sha: baseSha }
        );
        targetSha = created.object.sha;
      }

      // Create blobs for each file
      const treeItems = await Promise.all(
        pushFiles.map(async (file: GitPushFile) => {
          const blob = await githubPost<{ sha: string }>(
            `/repos/${ctx.workspace}/${ctx.repoSlug}/git/blobs`,
            { content: Buffer.from(file.content).toString("base64"), encoding: "base64" }
          );
          return {
            path: file.filePath,
            mode: "100644" as const,
            type: "blob" as const,
            sha: blob.sha,
          };
        })
      );

      // Create a new tree on top of the target branch's current tree
      const baseCommit = await githubFetch<{ tree: { sha: string } }>(
        `/repos/${ctx.workspace}/${ctx.repoSlug}/git/commits/${targetSha}`
      );
      const newTree = await githubPost<{ sha: string }>(
        `/repos/${ctx.workspace}/${ctx.repoSlug}/git/trees`,
        { base_tree: baseCommit.tree.sha, tree: treeItems }
      );

      // Create the commit
      const newCommit = await githubPost<{ sha: string }>(
        `/repos/${ctx.workspace}/${ctx.repoSlug}/git/commits`,
        { message: commitMessage, tree: newTree.sha, parents: [targetSha] }
      );

      // Fast-forward the target branch ref
      await githubPatch(
        `/repos/${ctx.workspace}/${ctx.repoSlug}/git/refs/heads/${encodeURIComponent(targetBranch)}`,
        { sha: newCommit.sha }
      );

      return { sha: newCommit.sha };
    },

    async createPullRequest(ctx, headBranch, baseBranch, title, body, draft = true) {
      const pr = await githubPost<{
        number: number;
        html_url: string;
        title: string;
        state: string;
        draft: boolean;
      }>(
        `/repos/${ctx.workspace}/${ctx.repoSlug}/pulls`,
        {
          title,
          body,
          head: headBranch,
          base: baseBranch,
          draft,
        }
      );
      return {
        number: pr.number,
        url: pr.html_url,
        title: pr.title,
        state: pr.state,
        draft: pr.draft,
      } satisfies GitPullRequest;
    },

    async updatePullRequest(ctx, prNumber, updates) {
      await githubPatch(
        `/repos/${ctx.workspace}/${ctx.repoSlug}/pulls/${prNumber}`,
        updates
      );
    },
  };
}
