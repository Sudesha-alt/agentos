import { logger } from "../../../utils/logger";
import { getJiraIssueStats } from "../../../jira-sync/issueRepository";
import { runJiraFullSync } from "../../../jira-sync/syncService";
import { syncSingleJiraIssueFromWebhook } from "../../../jira-sync/syncService";

/** @deprecated Use jira-sync — delegates to unified sync layer. */
export async function syncMirroredIssue(jiraKey: string): Promise<{
  synced: boolean;
  reason?: string;
}> {
  try {
    await syncSingleJiraIssueFromWebhook(jiraKey);
    logger.info({ jiraKey }, "jira mirror sync delegated to jira-sync");
    return { synced: true };
  } catch {
    return { synced: false, reason: "sync_failed" };
  }
}

/** @deprecated Use POST /jira-sync/run — runs full paginated sync. */
export async function runMirrorBackfill(options: {
  projectKeys?: string[];
  maxIssues?: number;
}): Promise<{
  processed: number;
  synced: number;
  skipped: number;
  errors: number;
}> {
  logger.warn(
    "runMirrorBackfill is deprecated — running full jira-sync instead"
  );
  const result = await runJiraFullSync({ projectKeys: options.projectKeys });
  return {
    processed: result.issuesSynced + result.issuesSkipped + result.errors,
    synced: result.issuesSynced,
    skipped: result.issuesSkipped,
    errors: result.errors,
  };
}

/** @deprecated Prefer GET /jira-sync/status stats. */
export async function getMirrorStats(): Promise<{
  total: number;
  embedded: number;
  byStatus: Record<string, number>;
}> {
  const stats = await getJiraIssueStats();
  return {
    total: stats.total,
    embedded: stats.embedded,
    byStatus: stats.byStatus,
  };
}
