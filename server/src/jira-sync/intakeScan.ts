import {
  getPipelineIntakeMapping,
  isPipelineIntakeStatus,
} from "../pipeline/jira/intakeConfig";
import { isPipelineJiraConfigured } from "../pipeline/jira/credentialsStore";
import { listIntakeColumnTickets } from "../pipeline/jira/boardService";
import { enqueueIntakeFromJiraKey } from "../pipeline/jira/intakeEnqueueService";
import { shouldEnqueueJiraKey, logIntakeSkipped } from "../pipeline/jira/intakeDedup";
import { isJiraKeyInPipelineQueue } from "../queue/inProcessRunner";
import { logger } from "../utils/logger";
import { listJiraIssuesByStatus } from "./issueRepository";
import { syncReferenceColumnTickets } from "./referenceSyncService";

export type IntakeScanSource = "live-jira" | "synced-db" | "startup" | "poll" | "manual";

export interface IntakeScanResult {
  scanned: number;
  enqueued: number;
  skipped: number;
  source: IntakeScanSource;
  errors: Array<{ jiraKey: string; message: string }>;
  skipReasons: Array<{ jiraKey: string; reason: string; message: string }>;
}

function intakeLogSource(
  source: IntakeScanSource
): "poll" | "scan" | "startup" | "manual" {
  if (source === "poll") return "poll";
  if (source === "startup") return "startup";
  if (source === "manual") return "manual";
  return "scan";
}

async function enqueueIssueKeys(
  keys: string[],
  source: IntakeScanSource
): Promise<IntakeScanResult> {
  if (keys.length === 0) {
    return { scanned: 0, enqueued: 0, skipped: 0, source, errors: [], skipReasons: [] };
  }

  if (!isPipelineJiraConfigured()) {
    logger.debug(
      { keyCount: keys.length, source },
      "intake enqueue skipped — pipeline Jira not configured yet"
    );
    return {
      scanned: keys.length,
      enqueued: 0,
      skipped: keys.length,
      source,
      errors: [],
      skipReasons: keys.map((jiraKey) => ({
        jiraKey,
        reason: "jira_not_configured",
        message: "Pipeline Jira credentials are not configured",
      })),
    };
  }

  let enqueued = 0;
  let skipped = 0;
  const errors: IntakeScanResult["errors"] = [];
  const skipReasons: IntakeScanResult["skipReasons"] = [];
  const logSource = intakeLogSource(source);

  for (const jiraKey of keys) {
    if (isJiraKeyInPipelineQueue(jiraKey)) {
      skipped += 1;
      continue;
    }

    const dedup = await shouldEnqueueJiraKey(jiraKey);
    if (!dedup.enqueue) {
      skipped += 1;
      await logIntakeSkipped(
        jiraKey,
        dedup.reason!,
        dedup.message ?? dedup.reason!,
        logSource
      );
      skipReasons.push({
        jiraKey,
        reason: dedup.reason!,
        message: dedup.message ?? dedup.reason!,
      });
      continue;
    }

    try {
      const result = await enqueueIntakeFromJiraKey(jiraKey, undefined, undefined, logSource);
      if (result.enqueued > 0) enqueued += result.enqueued;
      skipped += result.skipped;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ jiraKey, message });
      logger.warn({ err, jiraKey }, "intake scan enqueue failed");
    }
  }

  if (enqueued > 0 || errors.length > 0 || skipReasons.length > 0) {
    logger.info(
      { scanned: keys.length, enqueued, skipped, source, errors: errors.length },
      "intake scan complete"
    );
  }

  return { scanned: keys.length, enqueued, skipped, source, errors, skipReasons };
}

/** Enqueue pipeline intake for issues in AI Worker — live Jira first, synced DB fallback. */
export async function scanIntakeFromSyncedIssues(
  source: IntakeScanSource = "startup"
): Promise<IntakeScanResult> {
  const empty: IntakeScanResult = {
    scanned: 0,
    enqueued: 0,
    skipped: 0,
    source,
    errors: [],
    skipReasons: [],
  };

  if (!isPipelineJiraConfigured()) {
    logger.debug({ source }, "intake scan skipped — pipeline Jira not configured yet");
    return empty;
  }

  await syncReferenceColumnTickets().catch((err) =>
    logger.warn({ err }, "reference column sync before intake failed")
  );

  const intake = getPipelineIntakeMapping();
  const statuses = intake.aiWorkerStatuses ?? [];
  if (statuses.length === 0) {
    return empty;
  }

  try {
    const live = await listIntakeColumnTickets();
    const keys = [
      ...new Set(
        live.items
          .filter((item) => isPipelineIntakeStatus(item.status))
          .map((item) => item.key)
          .filter(Boolean)
      ),
    ];
    if (keys.length > 0) {
      return enqueueIssueKeys(keys, source === "startup" ? "live-jira" : source);
    }
  } catch (err) {
    logger.warn({ err }, "live Jira intake scan failed — falling back to synced DB");
  }

  const issues = await listJiraIssuesByStatus(statuses);
  const keys = issues
    .filter((issue) => isPipelineIntakeStatus(issue.status))
    .map((issue) => issue.jiraKey);

  return enqueueIssueKeys(keys, source === "startup" ? "synced-db" : source);
}
