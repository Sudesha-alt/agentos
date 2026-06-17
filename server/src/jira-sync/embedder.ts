import { shouldEmbedStatus } from "./config";
import type { FetchedJiraIssue } from "./issueFetcher";
import { embedSyncedIssueRecord } from "../rag/ticketEmbedService";

export { buildTicketEmbedChunks, ticketFieldsFromFetched } from "../rag/ticketEmbeddingText";

export async function embedSyncedIssue(
  issue: FetchedJiraIssue,
  gitContext?: string
): Promise<boolean> {
  if (!shouldEmbedStatus(issue.status)) {
    return false;
  }
  return embedSyncedIssueRecord(issue, gitContext);
}
