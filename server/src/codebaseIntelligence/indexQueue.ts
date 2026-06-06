import { runFullIndex } from "./indexer";
import { getRepoContext } from "../git-integration/gitCredentialsStore";
import { JOB_NAMES, codebaseQueue } from "../queue/jobQueue";
import { prisma } from "../db/client";
import { logger } from "../utils/logger";

const prismaAny = prisma as any;

export type EnqueueFullIndexResult = {
  runId: string;
  queued: boolean;
};

function hasRedisQueue(): boolean {
  return Boolean(process.env.REDIS_URL?.trim());
}

export async function enqueueFullIndex(
  branchName: string,
  triggerType: "manual" | "webhook" = "manual"
): Promise<EnqueueFullIndexResult> {
  const { workspace: repoOwner, repoSlug: repoName } = getRepoContext();

  const run = await prismaAny.codebaseIndexRun.create({
    data: {
      repoOwner,
      repoName,
      branchName,
      runType: "full",
      status: hasRedisQueue() ? "queued" : "running",
      triggerType,
    },
  });

  if (hasRedisQueue()) {
    await codebaseQueue.add(
      JOB_NAMES.RUN_CODEBASE_FULL,
      { branchName, runId: run.id, triggerType },
      { jobId: `full-${run.id}` }
    );
    logger.info({ runId: run.id, branchName }, "queued full codebase index");
    return { runId: run.id, queued: true };
  }

  void runFullIndex(branchName, { runId: run.id, triggerType }).catch((err) => {
    logger.warn({ err, runId: run.id, branchName }, "in-process full index failed");
  });
  return { runId: run.id, queued: false };
}

export async function getLatestIndexRun(input?: {
  repoOwner?: string;
  repoName?: string;
  branchName?: string;
}) {
  let repoOwner = input?.repoOwner;
  let repoName = input?.repoName;
  if (!repoOwner || !repoName) {
    try {
      const ctx = getRepoContext();
      repoOwner = ctx.workspace;
      repoName = ctx.repoSlug;
    } catch {
      return null;
    }
  }

  const where: Record<string, string> = { repoOwner, repoName };
  if (input?.branchName) where.branchName = input.branchName;

  return prismaAny.codebaseIndexRun.findFirst({
    where,
    orderBy: { startedAt: "desc" },
  });
}

export async function getIndexRunById(runId: string) {
  return prismaAny.codebaseIndexRun.findUnique({ where: { id: runId } });
}

export function indexRunProgress(run: {
  status: string;
  filesTotal: number;
  filesProcessed: number;
  filesIndexed: number;
  filesUpdated: number;
  filesDeleted: number;
  error?: string | null;
  startedAt: Date;
  completedAt?: Date | null;
}) {
  const total = run.filesTotal > 0 ? run.filesTotal : null;
  const processed = run.filesProcessed;
  const percent =
    total && total > 0
      ? Math.min(100, Math.round((processed / total) * 100))
      : run.status === "completed"
        ? 100
        : run.status === "queued"
          ? 0
          : null;

  return {
    status: run.status,
    filesTotal: total,
    filesProcessed: processed,
    filesIndexed: run.filesIndexed,
    filesUpdated: run.filesUpdated,
    filesDeleted: run.filesDeleted,
    percent,
    error: run.error ?? null,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
    done: run.status === "completed" || run.status === "failed",
  };
}
