import {
  getPipelineIntakeMapping,
  isPipelineIntakeStatus,
} from "../pipeline/jira/intakeConfig";
import { enqueueIntakeFromJiraKey } from "../pipeline/jira/intakeEnqueueService";
import { isJiraKeyInPipelineQueue } from "../queue/inProcessRunner";
import { logger } from "../utils/logger";
import { listJiraIssuesByStatus } from "./issueRepository";

/** Enqueue pipeline intake for synced issues already in AI Worker statuses. */
export async function scanIntakeFromSyncedIssues(): Promise<{
  scanned: number;
  enqueued: number;
}> {
  const intake = getPipelineIntakeMapping();
  const statuses = intake.aiWorkerStatuses ?? [];
  if (statuses.length === 0) {
    return { scanned: 0, enqueued: 0 };
  }

  const issues = await listJiraIssuesByStatus(statuses);
  let enqueued = 0;

  for (const issue of issues) {
    if (!isPipelineIntakeStatus(issue.status)) continue;
    if (isJiraKeyInPipelineQueue(issue.jiraKey)) continue;
    try {
      const result = await enqueueIntakeFromJiraKey(issue.jiraKey);
      if (result.enqueued > 0) enqueued += result.enqueued;
    } catch (err) {
      logger.warn({ err, jiraKey: issue.jiraKey }, "intake scan enqueue failed");
    }
  }

  if (enqueued > 0) {
    logger.info({ scanned: issues.length, enqueued }, "intake scan from synced issues");
  }

  return { scanned: issues.length, enqueued };
}
