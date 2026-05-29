import { Buffer } from "node:buffer";
import { retry } from "../utils/retry";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

function getToken(): string {
  return requiredEnv("GITHUB_TOKEN");
}

const API_BASE = "https://api.github.com";

export interface GitHubTreeItem {
  path: string;
  mode: string;
  type: "blob" | "tree";
  sha: string;
  size?: number;
}

interface RepoContext {
  owner: string;
  repo: string;
}

function defaultRepoContext(): RepoContext {
  return {
    owner: requiredEnv("GITHUB_REPO_OWNER"),
    repo: requiredEnv("GITHUB_REPO_NAME"),
  };
}

async function githubFetch<T>(path: string): Promise<T> {
  return retry(async () => {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${getToken()}`,
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

export const githubClient = {
  async getRepoTree(branchName: string): Promise<GitHubTreeItem[]> {
    const { owner, repo } = defaultRepoContext();
    const refData = await githubFetch<{ object: { sha: string } }>(
      `/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branchName)}`
    );
    const treeData = await githubFetch<{ tree: GitHubTreeItem[] }>(
      `/repos/${owner}/${repo}/git/trees/${refData.object.sha}?recursive=1`
    );
    return treeData.tree;
  },

  async getFileContent(filePath: string, branchName: string): Promise<{
    path: string;
    sha: string;
    size: number;
    content: string;
  }> {
    const { owner, repo } = defaultRepoContext();
    const data = await githubFetch<{
      path: string;
      sha: string;
      size: number;
      content: string;
      encoding: string;
    }>(
      `/repos/${owner}/${repo}/contents/${filePath}?ref=${encodeURIComponent(
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
    };
  },
};
