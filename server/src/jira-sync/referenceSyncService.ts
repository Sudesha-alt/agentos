import { listTicketsByStatuses } from "../pipeline/jira/boardService";
import { getPipelineReferenceStatuses } from "../pipeline/jira/intakeConfig";
import { isPipelineJiraConfigured } from "../pipeline/jira/credentialsStore";
import { fetchJiraIssueByKey } from "./issueFetcher";
import { upsertJiraIssueRecord } from "./issueRepository";
import { embedSyncedIssue } from "./embedder";
import { logger } from "../utils/logger";

export interface ReferenceSyncResult {
  scanned: number;
  synced: number;
  embedded: number;
  skipped: number;
  errors: number;
}

/** Fetch reference-column tickets (Done, Resolved, etc.), store in Postgres, embed incrementally. */
export async function syncReferenceColumnTickets(): Promise<ReferenceSyncResult> {
  const empty: ReferenceSyncResult = {
    scanned: 0,
    synced: 0,
    embedded: 0,
    skipped: 0,
    errors: 0,
  };

  if (!isPipelineJiraConfigured()) return empty;

  const statuses = getPipelineReferenceStatuses();
  if (!statuses.length) return empty;

  const { items } = await listTicketsByStatuses(statuses);
  if (!items.length) return empty;

  let synced = 0;
  let embedded = 0;
  let skipped = 0;
  let errors = 0;

  for (const item of items) {
    try {
      const issue = await fetchJiraIssueByKey(item.key);
      if (!issue) {
        skipped += 1;
        continue;
      }
      await upsertJiraIssueRecord(issue);
      synced += 1;

      const didEmbed = await embedSyncedIssue(issue);
      if (didEmbed) embedded += 1;
      else skipped += 1;
    } catch (err) {
      errors += 1;
      logger.warn({ err, jiraKey: item.key }, "reference column ticket sync failed");
    }
  }

  if (synced > 0 || errors > 0) {
    logger.info(
      { scanned: items.length, synced, embedded, skipped, errors, statuses },
      "reference column sync complete"
    );
  }

  return {
    scanned: items.length,
    synced,
    embedded,
    skipped,
    errors,
  };
}
