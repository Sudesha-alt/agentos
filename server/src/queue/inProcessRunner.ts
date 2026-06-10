import {
  isJiraSyncRunning,
  runJiraFullSync,
  runJiraIncrementalSync,
} from "../jira-sync/syncService";
import { runMirrorBackfill } from "../pipeline/jira/mirror/syncService";
import { runCanaryCycle } from "../canaryAgent";
import type { CanaryRunInput } from "../canaryAgent/types";
import { orchestrator } from "../pipeline/orchestrator";
import { logger } from "../utils/logger";
import {
  dequeueNextPending,
  enqueueQueueItem,
  getActiveQueueItem,
  listPendingQueueItems,
  listQueueItems,
  markQueueItemActive,
  markQueueItemCompleted,
  resetStaleActiveItems,
  isTicketOrKeyQueued,
  getQueueStats,
  type QueueItem,
} from "./pipelineQueueStore";

export { getQueueStats };

export interface PipelineRunResult {
  started: boolean;
  queued: boolean;
  position?: number;
  activeTicketId?: string | null;
  activeJiraKey?: string | null;
}

export interface PipelineBatchEnqueueResult {
  started: boolean;
  enqueued: number;
}

let draining = false;
let mirrorBackfillRunning = false;
let canaryRunning = false;
let activeCanaryRunId: string | null = null;

export function hydrateQueueFromDb(): void {
  const reset = resetStaleActiveItems();
  if (reset > 0) {
    logger.warn({ count: reset }, "reset stale ACTIVE queue items to PENDING after restart");
  }

  const active = getActiveQueueItem();
  if (active) {
    logger.info({ ticketId: active.ticketId, jiraKey: active.jiraKey }, "resuming active queue item");
    if (!draining) void drainQueue(active);
    return;
  }

  const next = dequeueNextPending();
  if (next && !draining) {
    logger.info({ ticketId: next.ticketId, jiraKey: next.jiraKey }, "starting queued item from DB on boot");
    void drainQueue(next);
  }
}

export function getPipelineQueueState(): {
  activeTicketId: string | null;
  activeJiraKey: string | null;
  queuedTicketIds: string[];
  queuedJiraKeys: string[];
  queueLength: number;
  items: ReturnType<typeof listQueueItems>;
} {
  const items = listQueueItems();
  const active = items.find((i) => i.status === "ACTIVE");
  const pending = items.filter((i) => i.status === "PENDING");
  return {
    activeTicketId: active?.ticket_id ?? null,
    activeJiraKey: active?.jira_key ?? null,
    queuedTicketIds: pending.map((i) => i.ticket_id),
    queuedJiraKeys: pending.map((i) => i.jira_key),
    queueLength: pending.length,
    items,
  };
}

export function isTicketInPipelineQueue(ticketId: string): boolean {
  return isTicketOrKeyQueued(ticketId, ticketId);
}

export function isJiraKeyInPipelineQueue(jiraKey: string): boolean {
  const active = getActiveQueueItem();
  if (active?.jiraKey === jiraKey) return true;
  return listPendingQueueItems().some((i) => i.jiraKey === jiraKey);
}

/** Enqueue a story group block — items stay contiguous in FIFO order. */
export function enqueuePipelineBatch(
  items: Array<{ ticketId: string; jiraKey: string }>
): PipelineBatchEnqueueResult {
  let enqueued = 0;
  let started = false;

  for (const item of items) {
    if (isTicketOrKeyQueued(item.ticketId, item.jiraKey)) {
      continue;
    }

    const result = runPipelineInBackground(item.ticketId, item.jiraKey);
    if (result.started) started = true;
    enqueued += 1;
  }

  return { started, enqueued };
}

/** FIFO queue — only one pipeline run active at a time. Backed by SQLite. */
export function runPipelineInBackground(
  ticketId: string,
  jiraKey?: string,
  options?: { resumePipelineId?: string }
): PipelineRunResult {
  const key = jiraKey ?? ticketId;
  const active = getActiveQueueItem();

  if (active?.ticketId === ticketId) {
    logger.warn({ ticketId }, "pipeline already running for this ticket");
    return {
      started: false,
      queued: false,
      activeTicketId: active.ticketId,
      activeJiraKey: active.jiraKey,
    };
  }

  if (isTicketOrKeyQueued(ticketId, key)) {
    const pending = listPendingQueueItems();
    const position = pending.findIndex((q) => q.ticketId === ticketId) + 1;
    logger.info({ ticketId, position }, "pipeline ticket already queued");
    return {
      started: false,
      queued: true,
      position: position || pending.length,
      activeTicketId: active?.ticketId ?? null,
      activeJiraKey: active?.jiraKey ?? null,
    };
  }

  const queued = enqueueQueueItem(ticketId, key);
  if (!queued) {
    return {
      started: false,
      queued: false,
      activeTicketId: active?.ticketId ?? null,
      activeJiraKey: active?.jiraKey ?? null,
    };
  }

  if (!active && !draining) {
    void drainQueue(queued, options?.resumePipelineId);
    return {
      started: true,
      queued: false,
      activeTicketId: ticketId,
      activeJiraKey: key,
    };
  }

  const position = listPendingQueueItems().length;
  logger.info(
    { ticketId, jiraKey: key, position, activeTicketId: active?.ticketId },
    "pipeline ticket queued"
  );
  return {
    started: false,
    queued: true,
    position,
    activeTicketId: active?.ticketId ?? null,
    activeJiraKey: active?.jiraKey ?? null,
  };
}

async function drainQueue(item: QueueItem, resumePipelineId?: string): Promise<void> {
  if (draining && getActiveQueueItem()?.id !== item.id) {
    return;
  }
  draining = true;
  markQueueItemActive(item.id);
  logger.info({ ticketId: item.ticketId, jiraKey: item.jiraKey }, "pipeline run started");

  try {
    if (resumePipelineId) {
      await orchestrator.resume(resumePipelineId);
    } else {
      await orchestrator.run(item.ticketId);
    }
    markQueueItemCompleted(item.id, "COMPLETED");
  } catch (err) {
    markQueueItemCompleted(item.id, "FAILED");
    logger.error({ err, ticketId: item.ticketId }, "in-process pipeline failed");
  } finally {
    draining = false;
    const next = dequeueNextPending();
    if (next) {
      await drainQueue(next);
    }
  }
}

export function resumePipelineInBackground(
  ticketId: string,
  jiraKey: string,
  pipelineId: string
): PipelineRunResult {
  return runPipelineInBackground(ticketId, jiraKey, { resumePipelineId: pipelineId });
}

/** Fire-and-forget Jira mirror backfill on the API process event loop. */
export function runMirrorBackfillInBackground(options: {
  projectKeys?: string[];
  maxIssues?: number;
}): { started: boolean } {
  if (mirrorBackfillRunning) {
    logger.warn("jira mirror backfill already running in-process");
    return { started: false };
  }

  mirrorBackfillRunning = true;
  void runMirrorBackfill(options)
    .catch((err) => {
      logger.error({ err }, "in-process jira mirror backfill failed");
    })
    .finally(() => {
      mirrorBackfillRunning = false;
    });

  return { started: true };
}

/** Fire-and-forget full or incremental Jira sync. */
export function runJiraSyncInBackground(options: {
  mode: "full" | "incremental";
  projectKeys?: string[];
}): { started: boolean } {
  if (isJiraSyncRunning()) {
    logger.warn("jira sync already running in-process");
    return { started: false };
  }

  const run =
    options.mode === "incremental"
      ? () => runJiraIncrementalSync({ projectKeys: options.projectKeys })
      : () => runJiraFullSync({ projectKeys: options.projectKeys });

  void run().catch((err) => {
    logger.error({ err, mode: options.mode }, "in-process jira sync failed");
  });

  return { started: true };
}

export function runCanaryInBackground(input: CanaryRunInput): {
  started: boolean;
  runId?: string;
} {
  if (canaryRunning) {
    logger.warn("canary already running in-process");
    return { started: false, runId: activeCanaryRunId ?? undefined };
  }

  canaryRunning = true;
  void runCanaryCycle(input)
    .then((result) => {
      if (result) activeCanaryRunId = result.runId;
    })
    .catch((err) => {
      logger.error({ err }, "in-process canary failed");
    })
    .finally(() => {
      canaryRunning = false;
    });

  return { started: true };
}

export function startJiraSyncScheduler(): void {
  const intervalMs = Number(process.env.JIRA_SYNC_INTERVAL_MS ?? 15 * 60 * 1000);
  if (intervalMs <= 0) return;

  setInterval(() => {
    if (isJiraSyncRunning()) return;
    runJiraSyncInBackground({ mode: "incremental" });
  }, intervalMs).unref();

  logger.info({ intervalMs }, "jira incremental sync scheduler started");
}

export function startIntakePollScheduler(): void {
  const intervalMs = Number(process.env.PIPELINE_INTAKE_POLL_MS ?? 2 * 60 * 1000);
  if (intervalMs <= 0) return;

  setInterval(() => {
    void import("../jira-sync/intakeScan")
      .then((m) => m.scanIntakeFromSyncedIssues("poll"))
      .catch((err: unknown) => {
        logger.warn({ err }, "intake poll scan failed");
      });
  }, intervalMs).unref();

  logger.info({ intervalMs }, "AI Worker intake poll scheduler started");
}
