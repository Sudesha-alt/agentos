import { prisma } from "../db/client";
import { getRepoContext } from "../git-integration/gitCredentialsStore";
import {
  resolveGithubAccessToken,
  getGitCredentials,
} from "../git-integration/gitCredentialsStore";
import { logger } from "../utils/logger";

export type ChangedFilesResult = {
  changedFiles: string[];
  deletedFiles: string[];
};

function parseGithubLinkNext(linkHeader: string | null): string | null {
  if (!linkHeader) return null;
  const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
  return match?.[1] ?? null;
}

export async function listPullRequestChangedFiles(input: {
  owner: string;
  repo: string;
  pullNumber: number;
}): Promise<ChangedFilesResult> {
  const token = await resolveGithubAccessToken();
  const changedFiles: string[] = [];
  const deletedFiles: string[] = [];

  let url: string | null =
    `https://api.github.com/repos/${input.owner}/${input.repo}/pulls/${input.pullNumber}/files?per_page=100`;

  while (url) {
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!res.ok) {
      logger.warn(
        { status: res.status, pullNumber: input.pullNumber },
        "listPullRequestChangedFiles failed"
      );
      break;
    }

    const files = (await res.json()) as Array<{
      filename?: string;
      status?: string;
    }>;

    for (const file of files) {
      const path = file.filename;
      if (!path) continue;
      if (file.status === "removed") {
        deletedFiles.push(path);
      } else {
        changedFiles.push(path);
      }
    }

    url = parseGithubLinkNext(res.headers.get("link"));
  }

  return { changedFiles, deletedFiles };
}

export async function resolveChangedFilesFromPush(input: {
  owner: string;
  repo: string;
  beforeSha: string;
  afterSha: string;
}): Promise<ChangedFilesResult> {
  const { beforeSha, afterSha } = input;
  if (!beforeSha || !afterSha || beforeSha === afterSha) {
    return { changedFiles: [], deletedFiles: [] };
  }

  const token = await resolveGithubAccessToken();
  const changedFiles: string[] = [];
  const deletedFiles: string[] = [];

  let url: string | null =
    `https://api.github.com/repos/${input.owner}/${input.repo}/compare/${beforeSha}...${afterSha}?per_page=100`;

  while (url) {
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });

    if (!res.ok) {
      logger.warn(
        { status: res.status, beforeSha, afterSha },
        "resolveChangedFilesFromPush compare API failed"
      );
      break;
    }

    const data = (await res.json()) as {
      files?: Array<{ filename?: string; status?: string; previous_filename?: string }>;
    };

    for (const file of data.files ?? []) {
      const path = file.filename;
      if (!path) continue;
      if (file.status === "removed") {
        deletedFiles.push(path);
      } else {
        changedFiles.push(path);
        if (file.status === "renamed" && file.previous_filename) {
          deletedFiles.push(file.previous_filename);
        }
      }
    }

    url = parseGithubLinkNext(res.headers.get("link"));
  }

  return {
    changedFiles: [...new Set(changedFiles)],
    deletedFiles: [...new Set(deletedFiles)],
  };
}

export async function resolveBitbucketChangedFiles(input: {
  workspace: string;
  repoSlug: string;
  beforeSha?: string;
  afterSha: string;
}): Promise<ChangedFilesResult> {
  const creds = getGitCredentials();
  if (creds.provider !== "bitbucket" || !creds.username || !creds.token) {
    return { changedFiles: [], deletedFiles: [] };
  }

  const authHeader = `Basic ${Buffer.from(`${creds.username}:${creds.token}`).toString("base64")}`;
  const spec =
    input.beforeSha && input.beforeSha !== input.afterSha
      ? `${input.beforeSha}..${input.afterSha}`
      : input.afterSha;

  const changedFiles: string[] = [];
  const deletedFiles: string[] = [];

  let url: string | null =
    `https://api.bitbucket.org/2.0/repositories/${input.workspace}/${input.repoSlug}/diffstat/${spec}?pagelen=100`;

  try {
    while (url) {
      const res = await fetch(url, { headers: { Authorization: authHeader } });
      if (!res.ok) {
        logger.warn({ status: res.status, spec }, "bitbucket diffstat failed");
        break;
      }

      const data = (await res.json()) as {
        values?: Array<{
          new?: { path?: string; type?: string };
          old?: { path?: string; type?: string };
          status?: string;
        }>;
        next?: string;
      };

      for (const row of data.values ?? []) {
        const newPath = row.new?.path;
        const oldPath = row.old?.path;
        const status = row.status ?? "";

        if (status === "removed" && oldPath) {
          deletedFiles.push(oldPath);
        } else if (newPath) {
          changedFiles.push(newPath);
          if (status === "renamed" && oldPath && oldPath !== newPath) {
            deletedFiles.push(oldPath);
          }
        }
      }

      url = data.next ?? null;
    }
  } catch (err) {
    logger.warn({ err, spec }, "bitbucket diffstat error");
  }

  return {
    changedFiles: [...new Set(changedFiles)],
    deletedFiles: [...new Set(deletedFiles)],
  };
}

/** Merge webhook file lists with compare/diffstat when lists are empty or likely truncated. */
export async function resolveWebhookChangedFiles(input: {
  provider: "github" | "bitbucket";
  owner: string;
  repo: string;
  workspace?: string;
  repoSlug?: string;
  beforeSha?: string;
  afterSha: string;
  webhookChanged: string[];
  webhookDeleted: string[];
  commitCount?: number;
}): Promise<ChangedFilesResult> {
  let changed = [...new Set(input.webhookChanged)];
  let deleted = [...new Set(input.webhookDeleted)];

  const needsFallback =
    (changed.length + deleted.length === 0) ||
    (input.provider === "github" && (input.commitCount ?? 0) >= 20);

  if (!needsFallback && changed.length + deleted.length > 0) {
    return { changedFiles: changed, deletedFiles: deleted };
  }

  if (input.provider === "github" && input.beforeSha && input.afterSha) {
    const fromCompare = await resolveChangedFilesFromPush({
      owner: input.owner,
      repo: input.repo,
      beforeSha: input.beforeSha,
      afterSha: input.afterSha,
    });
    if (fromCompare.changedFiles.length + fromCompare.deletedFiles.length > 0) {
      return fromCompare;
    }
  }

  if (input.provider === "bitbucket" && input.workspace && input.repoSlug) {
    const fromDiff = await resolveBitbucketChangedFiles({
      workspace: input.workspace,
      repoSlug: input.repoSlug,
      beforeSha: input.beforeSha,
      afterSha: input.afterSha,
    });
    if (fromDiff.changedFiles.length + fromDiff.deletedFiles.length > 0) {
      return fromDiff;
    }
  }

  return { changedFiles: changed, deletedFiles: deleted };
}

export async function isTrackedDefaultBranch(branchName: string): Promise<boolean> {
  try {
    const ctx = getRepoContext();
    return branchName === ctx.defaultBranch;
  } catch {
    return false;
  }
}

export async function isIndexRunInFlight(
  branchName: string
): Promise<boolean> {
  const { workspace: repoOwner, repoSlug: repoName } = getRepoContext();
  const prismaAny = prisma as any;
  const running = await prismaAny.codebaseIndexRun.findFirst({
    where: {
      repoOwner,
      repoName,
      branchName,
      status: "running",
    },
    select: { id: true },
  });
  return Boolean(running);
}
