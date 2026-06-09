import {
  getPipelineIntakeMapping,
  isPipelineIntakeStatus,
} from "../pipeline/jira/intakeConfig";
import { listIntakeColumnTickets } from "../pipeline/jira/boardService";
import { enqueueIntakeFromJiraKey } from "../pipeline/jira/intakeEnqueueService";
import { isJiraKeyInPipelineQueue } from "../queue/inProcessRunner";
import { logger } from "../utils/logger";
import { listJiraIssuesByStatus } from "./issueRepository";

export interface IntakeScanResult {
  scanned: number;
  enqueued: number;
  source: "live-jira" | "synced-db";
  errors: Array<{ jiraKey: string; message: string }>;
}

async function enqueueIssueKeys(
  keys: string[],
  source: IntakeScanResult["source"]
): Promise<IntakeScanResult> {
  let enqueued = 0;
  const errors: IntakeScanResult["errors"] = [];

  for (const jiraKey of keys) {
    if (isJiraKeyInPipelineQueue(jiraKey)) continue;
    try {
      const result = await enqueueIntakeFromJiraKey(jiraKey);
      if (result.enqueued > 0) enqueued += result.enqueued;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push({ jiraKey, message });
      logger.warn({ err, jiraKey }, "intake scan enqueue failed");
    }
  }

  if (enqueued > 0 || errors.length > 0) {
    logger.info({ scanned: keys.length, enqueued, source, errors: errors.length }, "intake scan complete");
  }

  return { scanned: keys.length, enqueued, source, errors };
}

/** Enqueue pipeline intake for issues in AI Worker — live Jira first, synced DB fallback. */
export async function scanIntakeFromSyncedIssues(): Promise<IntakeScanResult> {
  const intake = getPipelineIntakeMapping();
  const statuses = intake.aiWorkerStatuses ?? [];
  if (statuses.length === 0) {
    return { scanned: 0, enqueued: 0, source: "synced-db", errors: [] };
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
      return enqueueIssueKeys(keys, "live-jira");
    }
  } catch (err) {
    logger.warn({ err }, "live Jira intake scan failed — falling back to synced DB");
  }

  const issues = await listJiraIssuesByStatus(statuses);
  const keys = issues
    .filter((issue) => isPipelineIntakeStatus(issue.status))
    .map((issue) => issue.jiraKey);

  return enqueueIssueKeys(keys, "synced-db");
}
