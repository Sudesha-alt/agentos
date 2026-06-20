import { runFullIndex, runIncrementalIndex } from "./indexer";
import { getRepoContext } from "../git-integration/gitCredentialsStore";
import { resolveRepoIndexBranch } from "../git-integration/resolveRepoBranch";
import { requireActiveOrganizationId } from "../organization/orgScope";
import { prisma } from "../db/client";
import { logger } from "../utils/logger";
import {
  INCREMENTAL_INDEX_BATCH_SIZE,
  INCREMENTAL_INDEX_MAX_FILES,
} from "./retrievalConfig";
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
  const resolvedBranch = await resolveRepoIndexBranch(branchName);

  const run = await prismaAny.codebaseIndexRun.create({
    data: {
      organizationId,
      repoOwner,
      repoName,
      branchName: resolvedBranch,
      runType: "full",
      status: "running",
      triggerType,
      triggerSha: triggerSha ?? null,
    },
  });

  void runFullIndex(resolvedBranch, { runId: run.id, triggerType }).catch((err) => {
    logger.warn({ err, runId: run.id, branchName: resolvedBranch }, "in-process full index failed");
  });

  logger.info({ runId: run.id, branchName: resolvedBranch, triggerType }, "started full codebase index in-process");
  return { runId: run.id, queued: false };
}

function chunkFileLists(
  changedFiles: string[],
  deletedFiles: string[],
  batchSize: number
): Array<{ changedFiles: string[]; deletedFiles: string[] }> {
  const all = [
    ...changedFiles.map((p) => ({ path: p, kind: "changed" as const })),
    ...deletedFiles.map((p) => ({ path: p, kind: "deleted" as const })),
  ];
  const batches: Array<{ changedFiles: string[]; deletedFiles: string[] }> = [];
  for (let i = 0; i < all.length; i += batchSize) {
    const slice = all.slice(i, i + batchSize);
    batches.push({
      changedFiles: slice.filter((x) => x.kind === "changed").map((x) => x.path),
      deletedFiles: slice.filter((x) => x.kind === "deleted").map((x) => x.path),
    });
  }
  return batches.length ? batches : [{ changedFiles: [], deletedFiles: [] }];
}

async function startIncrementalBatchRun(input: {
  branchName: string;
  changedFiles: string[];
  deletedFiles: string[];
  commitSha: string;
  triggerType: "webhook" | "pr_merge";
  batchIndex: number;
  batchTotal: number;
  filesTotal: number;
}): Promise<string> {
  const { workspace: repoOwner, repoSlug: repoName } = getRepoContext();
  const organizationId = requireActiveOrganizationId();

  const run = await prismaAny.codebaseIndexRun.create({
    data: {
      organizationId,
      repoOwner,
      repoName,
      branchName: input.branchName,
      runType: input.batchTotal > 1 ? "incremental_batch" : "incremental",
      status: "running",
      triggerType: input.triggerType === "pr_merge" ? "pr_merge" : "webhook",
      triggerSha: input.commitSha,
      filesTotal: input.filesTotal,
      filesProcessed: 0,
    },
  });

  void runIncrementalIndex({
    branchName: input.branchName,
    changedFiles: input.changedFiles,
    deletedFiles: input.deletedFiles,
    commitSha: input.commitSha,
    triggerType: "webhook",
    runId: run.id,
    batchIndex: input.batchIndex,
    batchTotal: input.batchTotal,
  }).catch((err) => {
    logger.warn({ err, runId: run.id }, "incremental index batch failed");
  });

  return run.id;
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
    logger.warn(
      { total, max: INCREMENTAL_INDEX_MAX_FILES },
      "incremental file count exceeds max — capping to batched incremental"
    );
  }

  const batches = chunkFileLists(
    input.changedFiles,
    input.deletedFiles,
    INCREMENTAL_INDEX_BATCH_SIZE
  );

  let firstRunId: string | undefined;
  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]!;
    if (batch.changedFiles.length + batch.deletedFiles.length === 0) continue;

    if (i > 0) {
      await waitForIndexSlot(input.branchName);
    }

    const runId = await startIncrementalBatchRun({
      branchName: input.branchName,
      changedFiles: batch.changedFiles,
      deletedFiles: batch.deletedFiles,
      commitSha: input.commitSha,
      triggerType,
      batchIndex: i,
      batchTotal: batches.length,
      filesTotal: total,
    });
    if (!firstRunId) firstRunId = runId;
  }

  logger.info(
    {
      runId: firstRunId,
      branchName: input.branchName,
      triggerSource: input.triggerSource,
      prNumber: input.prNumber,
      fileCount: total,
      batchCount: batches.length,
    },
    "started batched incremental codebase index from webhook"
  );

  return { started: true, runId: firstRunId };
}

async function waitForIndexSlot(branchName: string, maxWaitMs = 30 * 60 * 1000): Promise<void> {
  const started = Date.now();
  while (await isIndexRunInFlight(branchName)) {
    if (Date.now() - started > maxWaitMs) {
      throw new Error("Timed out waiting for index slot");
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
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
