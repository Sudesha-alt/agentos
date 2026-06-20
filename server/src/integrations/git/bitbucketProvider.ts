import { retry } from "../../utils/retry";
import type {
  GitFileContent,
  GitProviderClient,
  GitRepoContext,
  GitTreeItem,
} from "./types";

const API_BASE = "https://api.bitbucket.org/2.0";

type BitbucketEntry = {
  path: string;
  type: "commit_file" | "commit_directory";
  size?: number;
};

function basicAuth(username: string, token: string): string {
  return `Basic ${Buffer.from(`${username}:${token}`).toString("base64")}`;
}

export function createBitbucketProvider(
  username: string,
  appPassword: string
): GitProviderClient {
  const authHeader = basicAuth(username, appPassword);

  async function bbFetch<T>(path: string): Promise<T> {
    return retry(async () => {
      const res = await fetch(`${API_BASE}${path}`, {
        headers: { Authorization: authHeader },
      });
      if (!res.ok) {
        throw new Error(`Bitbucket API ${res.status}: ${await res.text()}`);
      }
      return (await res.json()) as T;
    });
  }

  async function listDir(
    ctx: GitRepoContext,
    branchName: string,
    dirPath: string
  ): Promise<BitbucketEntry[]> {
    const suffix = dirPath ? `/${dirPath}` : "";
    const data = await bbFetch<{ values: BitbucketEntry[]; next?: string }>(
      `/repositories/${ctx.workspace}/${ctx.repoSlug}/src/${encodeURIComponent(branchName)}${suffix}?pagelen=100`
    );
    let values = data.values ?? [];
    let next: string | undefined = data.next;
    while (next) {
      const nextUrl = next;
      const page = await retry(async () => {
        const res = await fetch(nextUrl, { headers: { Authorization: authHeader } });
        if (!res.ok) throw new Error(`Bitbucket API ${res.status}`);
        return (await res.json()) as { values: BitbucketEntry[]; next?: string };
      });
      values = values.concat(page.values ?? []);
      next = page.next;
    }
    return values;
  }

  async function walkTree(
    ctx: GitRepoContext,
    branchName: string,
    dirPath: string,
    acc: GitTreeItem[]
  ): Promise<void> {
    const entries = await listDir(ctx, branchName, dirPath);
    for (const entry of entries) {
      if (entry.type === "commit_directory") {
        await walkTree(ctx, branchName, entry.path, acc);
      } else {
        acc.push({
          path: entry.path,
          type: "blob",
          sha: entry.path,
          size: entry.size,
        });
      }
    }
  }

  return {
    provider: "bitbucket",

    async testConnection(ctx) {
      const data = await bbFetch<{ full_name: string; mainbranch?: { name?: string } }>(
        `/repositories/${ctx.workspace}/${ctx.repoSlug}`
      );
      return {
        fullName: data.full_name,
        defaultBranch: data.mainbranch?.name,
      };
    },

    async branchExists(ctx, branchName) {
      try {
        await listDir(ctx, branchName, "");
        return true;
      } catch {
        return false;
      }
    },

    async getRepoTree(ctx, branchName) {
      const items: GitTreeItem[] = [];
      await walkTree(ctx, branchName, "", items);
      return items;
    },

    async getFileContent(ctx, filePath, branchName) {
      const res = await retry(async () => {
        const url = `${API_BASE}/repositories/${ctx.workspace}/${ctx.repoSlug}/src/${encodeURIComponent(branchName)}/${filePath}`;
        const response = await fetch(url, { headers: { Authorization: authHeader } });
        if (!response.ok) {
          throw new Error(`Bitbucket API ${response.status}: ${await response.text()}`);
        }
        return response;
      });
      const content = await res.text();
      return {
        path: filePath,
        sha: filePath,
        size: content.length,
        content,
      } satisfies GitFileContent;
    },

    cloneUrl(ctx) {
      return `https://${encodeURIComponent(username)}:${encodeURIComponent(appPassword)}@bitbucket.org/${ctx.workspace}/${ctx.repoSlug}.git`;
    },

    async pushFilesToBranch() {
      throw new Error("pushFilesToBranch is not supported for Bitbucket — use GitHub.");
    },
  };
}
