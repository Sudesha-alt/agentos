import { prisma } from "../db/client";
import { logger } from "../utils/logger";

const prismaAny = prisma as any;

export async function enqueueCodebaseIndexFromPush(input: {
  repoOwner: string;
  repoName: string;
  branchName: string;
  headSha: string;
  pushedBy: string;
  changedFiles: string[];
  deletedFiles: string[];
  commits: Array<{
    sha: string;
    message: string;
    author: string;
    authoredAt: Date;
    added: string[];
    modified: string[];
    removed: string[];
  }>;
}): Promise<void> {
  const {
    repoOwner,
    repoName,
    branchName,
    headSha,
    pushedBy,
    changedFiles,
    deletedFiles,
    commits,
  } = input;

  await prismaAny.branchState.upsert({
    where: {
      repoOwner_repoName_branchName: {
        repoOwner,
        repoName,
        branchName,
      },
    },
    create: {
      repoOwner,
      repoName,
      branchName,
      sourceBranch: "main",
      createdBy: "human",
      headSha,
      filesChanged: changedFiles,
      lastPushAt: new Date(),
      lastPushBy: pushedBy,
    },
    update: {
      headSha,
      filesChanged: changedFiles,
      lastPushAt: new Date(),
      lastPushBy: pushedBy,
    },
  });

  for (const commit of commits) {
    await prismaAny.commitHistory.upsert({
      where: {
        repoOwner_repoName_sha: {
          repoOwner,
          repoName,
          sha: commit.sha,
        },
      },
      create: {
        repoOwner,
        repoName,
        branchName,
        sha: commit.sha,
        message: commit.message,
        author: commit.author,
        authoredAt: commit.authoredAt,
        filesAdded: commit.added,
        filesModified: commit.modified,
        filesDeleted: commit.removed,
        pushedBy,
      },
      update: {},
    });
  }

  logger.info(
    { branchName, changedCount: changedFiles.length, deletedCount: deletedFiles.length },
    "recorded push metadata — re-index from Codebase Intelligence or Git integration to refresh"
  );
}
