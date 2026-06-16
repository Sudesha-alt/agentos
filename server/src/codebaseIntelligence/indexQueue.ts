import { runFullIndex, runIncrementalIndex } from "./indexer";
import { getRepoContext } from "../git-integration/gitCredentialsStore";
import { requireActiveOrganizationId } from "../organization/orgScope";
import { prisma } from "../db/client";
import { logger } from "../utils/logger";
import { INCREMENTAL_INDEX_MAX_FILES } from "./retrievalConfig";
import { isIndexRunInFlight } from "./webhookIndexHelpers";

const prismaAny = prisma as any;

export type EnqueueFullIndexResult = {
  runId: string;
  queued: boolean;
};

const recentIndexShas = new Set<string>();
const MAX_RECENT_SHAS = 200;
const lastPrMergeByBranch = new Map<string, { prNumber: number; at: number }>();

export function getLastPrMergeForBranch(branchName: string): number | null {
  return lastPrMergeByBranch.get(branchName)?.prNumber ?? null;
}

export function markIndexShaProcessed(sha: string): boolean {
  const key = sha.trim();
  if (!key) return false;
  if (recentIndexShas.has(key)) return true;
  recentIndexShas.add(key);
  if (recentIndexShas.size > MAX_RECENT_SHAS) {
    const first = recentIndexShas.values().next().value;
    if (first) recentIndexShas.delete(first);
  }
  return false;
}

export async function enqueueFullIndex(
  branchName: string,
  triggerType: "manual" | "webhook" | "pr_merge" = "manual",
  triggerSha?: string
): Promise<EnqueueFullIndexResult> {
  const organizationId = requireActiveOrganizationId();
  const { workspace: repoOwner, repoSlug: repoName } = getRepoContext();

  const run = await prismaAny.codebaseIndexRun.create({
    data: {
      organizationId,
      repoOwner,
      repoName,
      branchName,
      runType: "full",
      status: "running",
      triggerType,
      triggerSha: triggerSha ?? null,
    },
  });

  void runFullIndex(branchName, { runId: run.id, triggerType }).catch((err) => {
    logger.warn({ err, runId: run.id, branchName }, "in-process full index failed");
  });

  logger.info({ runId: run.id, branchName, triggerType }, "started full codebase index in-process");
  return { runId: run.id, queued: false };
}

export async function enqueueIncrementalIndexFromWebhook(input: {
  branchName: string;
  changedFiles: string[];
  deletedFiles: string[];
  commitSha: string;
  triggerSource: "push" | "pr_merge";
  prNumber?: number;
}): Promise<{ started: boolean; skipped?: string; runId?: string }> {
  const total = input.changedFiles.length + input.deletedFiles.length;
  if (total === 0) {
    return { started: false, skipped: "no_files" };
  }

  if (markIndexShaProcessed(input.commitSha)) {
    return { started: false, skipped: "duplicate_sha" };
  }

  if (await isIndexRunInFlight(input.branchName)) {
    return { started: false, skipped: "index_in_flight" };
  }

  const triggerType = input.triggerSource === "pr_merge" ? "pr_merge" : "webhook";

  if (input.triggerSource === "pr_merge" && input.prNumber) {
    lastPrMergeByBranch.set(input.branchName, {
      prNumber: input.prNumber,
      at: Date.now(),
    });
  }

  if (total > INCREMENTAL_INDEX_MAX_FILES) {
    const { runId } = await enqueueFullIndex(input.branchName, triggerType, input.commitSha);
    return { started: true, runId };
  }

  const { workspace: repoOwner, repoSlug: repoName } = getRepoContext();
  const organizationId = requireActiveOrganizationId();

  const run = await prismaAny.codebaseIndexRun.create({
    data: {
      organizationId,
      repoOwner,
      repoName,
      branchName: input.branchName,
      runType: "incremental",
      status: "running",
      triggerType,
      triggerSha: input.commitSha,
    },
  });

  void runIncrementalIndex({
    branchName: input.branchName,
    changedFiles: input.changedFiles,
    deletedFiles: input.deletedFiles,
    commitSha: input.commitSha,
    triggerType: "webhook",
    runId: run.id,
  }).catch((err) => {
    logger.warn({ err, runId: run.id }, "incremental index from webhook failed");
  });

  logger.info(
    {
      runId: run.id,
      branchName: input.branchName,
      triggerSource: input.triggerSource,
      prNumber: input.prNumber,
      fileCount: total,
    },
    "started incremental codebase index from webhook"
  );

  return { started: true, runId: run.id };
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

  const organizationId = requireActiveOrganizationId();
  const where: Record<string, string> = { organizationId, repoOwner, repoName };
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
