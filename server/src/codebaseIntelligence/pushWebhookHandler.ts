import { prisma } from "../db/client";
import { getActiveOrganizationId } from "../organization/context";
import { logger } from "../utils/logger";
import { enqueueIncrementalIndexFromWebhook } from "./indexQueue";
import { isTrackedDefaultBranch } from "./webhookIndexHelpers";

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
  triggerSource?: "push" | "pr_merge";
  prNumber?: number;
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
    triggerSource = "push",
    prNumber,
  } = input;

  const organizationId = getActiveOrganizationId();
  if (!organizationId) {
    logger.warn({ repoOwner, repoName, branchName }, "push webhook skipped — no organization context");
    return;
  }

  await prismaAny.branchState.upsert({
    where: {
      organizationId_repoOwner_repoName_branchName: {
        organizationId,
        repoOwner,
        repoName,
        branchName,
      },
    },
    create: {
      organizationId,
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
        organizationId_repoOwner_repoName_sha: {
          organizationId,
          repoOwner,
          repoName,
          sha: commit.sha,
        },
      },
      create: {
        organizationId,
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

  const onDefaultBranch = await isTrackedDefaultBranch(branchName);
  if (!onDefaultBranch) {
    logger.info({ branchName }, "push webhook skipped — not default branch");
    return;
  }

  const indexResult = await enqueueIncrementalIndexFromWebhook({
    branchName,
    changedFiles,
    deletedFiles,
    commitSha: headSha,
    triggerSource,
    prNumber,
  });

  logger.info(
    {
      branchName,
      changedCount: changedFiles.length,
      deletedCount: deletedFiles.length,
      triggerSource,
      indexStarted: indexResult.started,
      indexSkipped: indexResult.skipped,
    },
    "processed push webhook metadata and index enqueue"
  );
}
