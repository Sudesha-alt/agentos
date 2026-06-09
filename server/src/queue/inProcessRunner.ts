import {
  isJiraSyncRunning,
  runJiraFullSync,
  runJiraIncrementalSync,
} from "../jira-sync/syncService";
import { runMirrorBackfill } from "../pipeline/jira/mirror/syncService";
import { orchestrator } from "../pipeline/orchestrator";
import { logger } from "../utils/logger";

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

interface QueueItem {
  ticketId: string;
  jiraKey: string;
}

let activeItem: QueueItem | null = null;
const queue: QueueItem[] = [];
const queuedTicketIds = new Set<string>();
const queuedJiraKeys = new Set<string>();
let mirrorBackfillRunning = false;

export function getPipelineQueueState(): {
  activeTicketId: string | null;
  activeJiraKey: string | null;
  queuedTicketIds: string[];
  queuedJiraKeys: string[];
  queueLength: number;
} {
  return {
    activeTicketId: activeItem?.ticketId ?? null,
    activeJiraKey: activeItem?.jiraKey ?? null,
    queuedTicketIds: queue.map((item) => item.ticketId),
    queuedJiraKeys: queue.map((item) => item.jiraKey),
    queueLength: queue.length,
  };
}

export function isTicketInPipelineQueue(ticketId: string): boolean {
  return activeItem?.ticketId === ticketId || queuedTicketIds.has(ticketId);
}

export function isJiraKeyInPipelineQueue(jiraKey: string): boolean {
  return activeItem?.jiraKey === jiraKey || queuedJiraKeys.has(jiraKey);
}

/** Enqueue a story group block — items stay contiguous in FIFO order. */
export function enqueuePipelineBatch(
  items: QueueItem[]
): PipelineBatchEnqueueResult {
  let enqueued = 0;
  let started = false;

  for (const item of items) {
    if (isTicketInPipelineQueue(item.ticketId) || isJiraKeyInPipelineQueue(item.jiraKey)) {
      continue;
    }

    const result = runPipelineInBackground(item.ticketId, item.jiraKey);
    if (result.started) started = true;
    enqueued += 1;
  }

  return { started, enqueued };
}

/** FIFO queue — only one pipeline run active at a time. */
export function runPipelineInBackground(
  ticketId: string,
  jiraKey?: string
): PipelineRunResult {
  const item: QueueItem = { ticketId, jiraKey: jiraKey ?? ticketId };

  if (activeItem?.ticketId === ticketId) {
    logger.warn({ ticketId }, "pipeline already running for this ticket");
    return {
      started: false,
      queued: false,
      activeTicketId: activeItem.ticketId,
      activeJiraKey: activeItem.jiraKey,
    };
  }

  if (queuedTicketIds.has(ticketId)) {
    const position = queue.findIndex((q) => q.ticketId === ticketId) + 1;
    logger.info({ ticketId, position }, "pipeline ticket already queued");
    return {
      started: false,
      queued: true,
      position: position || queue.length,
      activeTicketId: activeItem?.ticketId ?? null,
      activeJiraKey: activeItem?.jiraKey ?? null,
    };
  }

  if (activeItem === null) {
    void drainQueue(item);
    return {
      started: true,
      queued: false,
      activeTicketId: ticketId,
      activeJiraKey: item.jiraKey,
    };
  }

  queue.push(item);
  queuedTicketIds.add(ticketId);
  queuedJiraKeys.add(item.jiraKey);
  logger.info(
    { ticketId, jiraKey: item.jiraKey, position: queue.length, activeTicketId: activeItem.ticketId },
    "pipeline ticket queued"
  );
  return {
    started: false,
    queued: true,
    position: queue.length,
    activeTicketId: activeItem.ticketId,
    activeJiraKey: activeItem.jiraKey,
  };
}

async function drainQueue(item: QueueItem): Promise<void> {
  activeItem = item;
  logger.info({ ticketId: item.ticketId, jiraKey: item.jiraKey }, "pipeline run started");

  try {
    await orchestrator.run(item.ticketId);
  } catch (err) {
    logger.error({ err, ticketId: item.ticketId }, "in-process pipeline failed");
  } finally {
    activeItem = null;
    const next = queue.shift();
    if (next) {
      queuedTicketIds.delete(next.ticketId);
      queuedJiraKeys.delete(next.jiraKey);
      await drainQueue(next);
    }
  }
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

export function startJiraSyncScheduler(): void {
  const intervalMs = Number(process.env.JIRA_SYNC_INTERVAL_MS ?? 15 * 60 * 1000);
  if (intervalMs <= 0) return;

  setInterval(() => {
    if (isJiraSyncRunning()) return;
    runJiraSyncInBackground({ mode: "incremental" });
  }, intervalMs).unref();

  logger.info({ intervalMs }, "jira incremental sync scheduler started");
}
