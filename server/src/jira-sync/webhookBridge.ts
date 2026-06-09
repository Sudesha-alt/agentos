import { logger } from "../utils/logger";
import { markJiraIssueDeleted } from "./issueRepository";
import { syncSingleJiraIssueFromWebhookWithRetry } from "./syncService";
import type { PipelineJiraWebhookPayload } from "../pipeline/jira/ticketNormalizer";

export async function upsertJiraIssueFromWebhook(
  payload: PipelineJiraWebhookPayload
): Promise<void> {
  const jiraKey = payload.issue.key;
  await syncSingleJiraIssueFromWebhookWithRetry(jiraKey);
  logger.debug({ jiraKey }, "jira sync webhook upsert complete");
}

export async function handleJiraIssueDeleted(jiraKey: string): Promise<void> {
  await markJiraIssueDeleted(jiraKey);
  logger.info({ jiraKey }, "jira issue marked deleted from webhook");
}
