import { prisma } from "../db/client";
import { getRepoContext } from "../git-integration/gitCredentialsStore";
import { resolveGithubAccessToken } from "../git-integration/gitCredentialsStore";
import { logger } from "../utils/logger";

export async function listPullRequestChangedFiles(input: {
  owner: string;
  repo: string;
  pullNumber: number;
}): Promise<{ changedFiles: string[]; deletedFiles: string[] }> {
  const token = await resolveGithubAccessToken();
  const url = `https://api.github.com/repos/${input.owner}/${input.repo}/pulls/${input.pullNumber}/files?per_page=100`;
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
    return { changedFiles: [], deletedFiles: [] };
  }

  const files = (await res.json()) as Array<{
    filename?: string;
    status?: string;
  }>;

  const changedFiles: string[] = [];
  const deletedFiles: string[] = [];

  for (const file of files) {
    const path = file.filename;
    if (!path) continue;
    if (file.status === "removed") {
      deletedFiles.push(path);
    } else {
      changedFiles.push(path);
    }
  }

  return { changedFiles, deletedFiles };
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
