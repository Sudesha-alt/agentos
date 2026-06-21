import {
  isJiraSyncRunning,
  runJiraFullSync,
  runJiraIncrementalSync,
} from "../jira-sync/syncService";
import { isPipelineJiraConfigured } from "../pipeline/jira/credentialsStore";
import { runMirrorBackfill } from "../pipeline/jira/mirror/syncService";
import { runCanaryCycle } from "../canaryAgent";
import type { CanaryRunInput } from "../canaryAgent/types";
import { orchestrator } from "../pipeline/orchestrator";
import { logger } from "../utils/logger";
import { withOrganizationContext } from "../api/orgRequestContext";
import { listOrganizationIdsWithJiraConfig } from "../organization/webhookResolver";
import {
  dequeueNextPending,
  enqueueQueueItem,
  getActiveQueueItem,
  listPendingQueueItems,
  listQueueItems,
  markQueueItemActive,
  markQueueItemCompleted,
  isTicketOrKeyQueued,
  getQueueStats,
  type QueueItem,
} from "./pipelineQueueStore";
import { listBootRecoveryOrganizationIds } from "./bootRecovery";

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

const drainingByOrg = new Set<string>();
let mirrorBackfillRunning = false;
let canaryRunning = false;
let activeCanaryRunId: string | null = null;

/** Start or resume FIFO drain for an org when nothing is currently draining. */
async function ensureOrgQueueDraining(
  organizationId: string,
  options?: { resumePipelineId?: string; preferTicketId?: string }
): Promise<void> {
  if (drainingByOrg.has(organizationId)) return;

  const active = await getActiveQueueItem(organizationId);
  if (active) {
    void drainQueue(
      active,
      active.ticketId === options?.preferTicketId ? options?.resumePipelineId : undefined
    );
    return;
  }

  let next = await dequeueNextPending(organizationId);
  if (
    options?.preferTicketId &&
    next &&
    next.ticketId !== options.preferTicketId
  ) {
    const pending = await listPendingQueueItems(organizationId);
    next = pending.find((p) => p.ticketId === options.preferTicketId) ?? next;
  }

  if (next) {
    void drainQueue(
      next,
      next.ticketId === options?.preferTicketId ? options?.resumePipelineId : undefined
    );
  }
}

export function startDrainForOrganization(organizationId: string): void {
  void ensureOrgQueueDraining(organizationId);
}

export async function hydrateQueueFromDb(): Promise<void> {
  const orgIds = await listBootRecoveryOrganizationIds();
  for (const organizationId of orgIds) {
    startDrainForOrganization(organizationId);
  }
}

async function hydrateOrganizationQueue(organizationId: string): Promise<void> {
  await ensureOrgQueueDraining(organizationId);
}

export async function getPipelineQueueState(organizationId: string): Promise<{
  activeTicketId: string | null;
  activeJiraKey: string | null;
  queuedTicketIds: string[];
  queuedJiraKeys: string[];
  queueLength: number;
  items: Awaited<ReturnType<typeof listQueueItems>>;
}> {
  const items = await listQueueItems(organizationId);
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

export async function isTicketInPipelineQueue(
  ticketId: string,
  organizationId?: string
): Promise<boolean> {
  return isTicketOrKeyQueued(ticketId, ticketId, organizationId);
}

export async function isJiraKeyInPipelineQueue(
  jiraKey: string,
  organizationId?: string
): Promise<boolean> {
  const active = await getActiveQueueItem(organizationId);
  if (active?.jiraKey === jiraKey) return true;
  const pending = await listPendingQueueItems(organizationId);
  return pending.some((i) => i.jiraKey === jiraKey);
}

/** Enqueue a story group block — items stay contiguous in FIFO order. */
export async function enqueuePipelineBatch(
  items: Array<{ ticketId: string; jiraKey: string }>,
  organizationId?: string
): Promise<PipelineBatchEnqueueResult> {
  let enqueued = 0;
  let started = false;

  for (const item of items) {
    if (await isTicketOrKeyQueued(item.ticketId, item.jiraKey, organizationId)) {
      continue;
    }

    const result = await runPipelineInBackground(item.ticketId, item.jiraKey, {
      organizationId,
    });
    if (result.started) started = true;
    enqueued += 1;
  }

  return { started, enqueued };
}

/** FIFO queue — one pipeline run active at a time per org. Backed by Postgres. */
export async function runPipelineInBackground(
  ticketId: string,
  jiraKey?: string,
  options?: { resumePipelineId?: string; organizationId?: string }
): Promise<PipelineRunResult> {
  const key = jiraKey ?? ticketId;
  const organizationId = options?.organizationId;
  const active = await getActiveQueueItem(organizationId);

  if (active?.ticketId === ticketId) {
    logger.warn({ ticketId }, "pipeline already running for this ticket");
    return {
      started: false,
      queued: false,
      activeTicketId: active.ticketId,
      activeJiraKey: active.jiraKey,
    };
  }

  if (await isTicketOrKeyQueued(ticketId, key, organizationId)) {
    const pending = await listPendingQueueItems(organizationId);
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

  const queued = await enqueueQueueItem(ticketId, key, organizationId);
  if (!queued) {
    return {
      started: false,
      queued: false,
      activeTicketId: active?.ticketId ?? null,
      activeJiraKey: active?.jiraKey ?? null,
    };
  }

  const orgId = queued.organizationId;
  const hadBlockingActive = Boolean(active);
  await ensureOrgQueueDraining(orgId, {
    resumePipelineId: options?.resumePipelineId,
    preferTicketId: ticketId,
  });

  const pending = await listPendingQueueItems(organizationId);
  const isPending = pending.some((q) => q.ticketId === ticketId);
  const activeNow = await getActiveQueueItem(organizationId);

  if (!hadBlockingActive && !isPending) {
    logger.info({ ticketId, jiraKey: key, organizationId: orgId }, "pipeline run kicked");
    return {
      started: true,
      queued: false,
      activeTicketId: ticketId,
      activeJiraKey: key,
    };
  }

  const position = pending.findIndex((q) => q.ticketId === ticketId) + 1;
  logger.info(
    { ticketId, jiraKey: key, position, activeTicketId: activeNow?.ticketId },
    "pipeline ticket queued"
  );
  return {
    started: false,
    queued: isPending,
    position: position || pending.length,
    activeTicketId: activeNow?.ticketId ?? null,
    activeJiraKey: activeNow?.jiraKey ?? null,
  };
}

async function drainQueue(item: QueueItem, resumePipelineId?: string): Promise<void> {
  const orgId = item.organizationId;
  if (drainingByOrg.has(orgId)) return;

  drainingByOrg.add(orgId);
  await markQueueItemActive(item.id);
  logger.info(
    { ticketId: item.ticketId, jiraKey: item.jiraKey, organizationId: orgId },
    "pipeline run started"
  );

  try {
    await withOrganizationContext(orgId, async () => {
      if (resumePipelineId) {
        await orchestrator.resume(resumePipelineId);
      } else {
        await orchestrator.run(item.ticketId);
      }
    });
    await markQueueItemCompleted(item.id, "COMPLETED");
  } catch (err) {
    await markQueueItemCompleted(item.id, "FAILED");
    logger.error({ err, ticketId: item.ticketId }, "in-process pipeline failed");
  } finally {
    drainingByOrg.delete(orgId);
    const next = await dequeueNextPending(orgId);
    if (next) {
      await drainQueue(next);
    }
  }
}

export async function resumePipelineInBackground(
  ticketId: string,
  jiraKey: string,
  pipelineId: string,
  organizationId?: string
): Promise<PipelineRunResult> {
  return runPipelineInBackground(ticketId, jiraKey, {
    resumePipelineId: pipelineId,
    organizationId,
  });
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
  organizationId: string;
}): { started: boolean } {
  if (!isPipelineJiraConfigured()) {
    return { started: false };
  }
  if (isJiraSyncRunning(options.organizationId)) {
    logger.warn({ organizationId: options.organizationId }, "jira sync already running in-process");
    return { started: false };
  }

  const run = async () =>
    withOrganizationContext(options.organizationId, async () => {
      if (options.mode === "incremental") {
        return runJiraIncrementalSync({ projectKeys: options.projectKeys });
      }
      return runJiraFullSync({ projectKeys: options.projectKeys });
    });

  void run().catch((err) => {
    logger.error({ err, mode: options.mode, organizationId: options.organizationId }, "in-process jira sync failed");
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
    void listOrganizationIdsWithJiraConfig()
      .then((orgIds) => {
        for (const organizationId of orgIds) {
          if (isJiraSyncRunning(organizationId)) continue;
          void withOrganizationContext(organizationId, async () => {
            if (!isPipelineJiraConfigured()) return;
            runJiraSyncInBackground({ mode: "incremental", organizationId });
          });
        }
      })
      .catch((err: unknown) => {
        logger.warn({ err }, "jira sync scheduler org list failed");
      });
  }, intervalMs).unref();

  logger.info({ intervalMs }, "jira incremental sync scheduler started");
}

export function startIntakePollScheduler(): void {
  const intervalMs = Number(process.env.PIPELINE_INTAKE_POLL_MS ?? 2 * 60 * 1000);
  if (intervalMs <= 0) return;

  setInterval(() => {
    void listOrganizationIdsWithJiraConfig()
      .then((orgIds) => {
        for (const organizationId of orgIds) {
          void withOrganizationContext(organizationId, () =>
            import("../jira-sync/intakeScan").then((m) => m.scanIntakeFromSyncedIssues("poll"))
          ).catch((err: unknown) => {
            logger.warn({ err, organizationId }, "intake poll scan failed");
          });
        }
      })
      .catch((err: unknown) => {
        logger.warn({ err }, "intake poll scheduler org list failed");
      });
  }, intervalMs).unref();

  logger.info({ intervalMs }, "AI Worker intake poll scheduler started");
}
