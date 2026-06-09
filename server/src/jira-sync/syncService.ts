import { searchIssues } from "../jira-intake/jiraApiClient";
import { withRetry } from "../utils/retry";
import { logger } from "../utils/logger";
import { getJiraSyncConfig } from "./config";
import { embedSyncedIssue } from "./embedder";
import {
  fetchJiraIssueByKey,
  mapJiraApiIssue,
  type FetchedJiraIssue,
} from "./issueFetcher";
import { upsertJiraIssueRecord } from "./issueRepository";
import { buildFullSyncJql, buildIncrementalSyncJql } from "./jql";
import {
  completeSyncRun,
  createSyncRun,
  getLastSuccessfulWatermark,
  isJiraSyncRunning,
  setJiraSyncRunning,
} from "./syncState";
import { scanIntakeFromSyncedIssues } from "./intakeScan";

interface JiraSearchIssue {
  id: string;
  key: string;
  fields: Record<string, unknown>;
}

async function processIssue(
  issue: FetchedJiraIssue
): Promise<{ synced: boolean; embedded: boolean }> {
  await upsertJiraIssueRecord(issue);
  let embedded = false;
  try {
    embedded = await embedSyncedIssue(issue);
  } catch (err) {
    logger.warn({ err, jiraKey: issue.jiraKey }, "jira sync embed failed");
  }
  return { synced: true, embedded };
}

async function paginatedSync(jql: string): Promise<{
  issuesSynced: number;
  issuesSkipped: number;
  errors: number;
  latestUpdated: Date | null;
}> {
  const cfg = getJiraSyncConfig();
  let nextPageToken: string | undefined;
  let isLast = false;
  let issuesSynced = 0;
  let issuesSkipped = 0;
  let errors = 0;
  let latestUpdated: Date | null = null;

  while (!isLast) {
    const page = await withRetry(
      () =>
        searchIssues<JiraSearchIssue>(jql, {
          maxResults: cfg.pageSize,
          nextPageToken,
        }),
      {
        maxAttempts: 3,
        baseDelayMs: 1000,
        maxDelayMs: 10000,
        context: { operation: "jira-sync-search" },
      }
    );

    for (const raw of page.issues) {
      try {
        const mapped = mapJiraApiIssue(raw, cfg.maxComments);
        if (mapped.jiraUpdatedAt) {
          if (!latestUpdated || mapped.jiraUpdatedAt > latestUpdated) {
            latestUpdated = mapped.jiraUpdatedAt;
          }
        }
        const result = await processIssue(mapped);
        if (result.synced) issuesSynced += 1;
        else issuesSkipped += 1;
      } catch (err) {
        errors += 1;
        logger.warn({ err, jiraKey: raw.key }, "jira sync issue failed");
      }
    }

    isLast = page.isLast;
    nextPageToken = page.nextPageToken;
    if (!page.issues.length) break;
  }

  return { issuesSynced, issuesSkipped, errors, latestUpdated };
}

export async function runJiraFullSync(options?: {
  projectKeys?: string[];
}): Promise<{
  runId: string;
  issuesSynced: number;
  issuesSkipped: number;
  errors: number;
}> {
  if (isJiraSyncRunning()) {
    throw new Error("Jira sync already running");
  }

  setJiraSyncRunning(true);
  const run = await createSyncRun("FULL");
  const jql = buildFullSyncJql(options?.projectKeys);

  try {
    const result = await paginatedSync(jql);
    await completeSyncRun(run.id, {
      status: result.errors > 0 && result.issuesSynced === 0 ? "FAILED" : "COMPLETED",
      issuesSynced: result.issuesSynced,
      issuesSkipped: result.issuesSkipped,
      errors: result.errors,
      watermark: result.latestUpdated ?? new Date(),
    });

    await scanIntakeFromSyncedIssues().catch((err) =>
      logger.warn({ err }, "intake scan after full sync failed")
    );

    logger.info({ runId: run.id, ...result, jql }, "jira full sync complete");
    return { runId: run.id, ...result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await completeSyncRun(run.id, {
      status: "FAILED",
      issuesSynced: 0,
      issuesSkipped: 0,
      errors: 1,
      errorMessage: message,
    });
    throw err;
  } finally {
    setJiraSyncRunning(false);
  }
}

export async function runJiraIncrementalSync(options?: {
  projectKeys?: string[];
}): Promise<{
  runId: string;
  issuesSynced: number;
  issuesSkipped: number;
  errors: number;
}> {
  if (isJiraSyncRunning()) {
    throw new Error("Jira sync already running");
  }

  setJiraSyncRunning(true);
  const run = await createSyncRun("INCREMENTAL");
  const watermark =
    (await getLastSuccessfulWatermark()) ??
    new Date(Date.now() - 24 * 60 * 60 * 1000);
  const jql = buildIncrementalSyncJql(watermark, options?.projectKeys);

  try {
    const result = await paginatedSync(jql);
    await completeSyncRun(run.id, {
      status: result.errors > 0 && result.issuesSynced === 0 ? "FAILED" : "COMPLETED",
      issuesSynced: result.issuesSynced,
      issuesSkipped: result.issuesSkipped,
      errors: result.errors,
      watermark: result.latestUpdated ?? new Date(),
    });

    await scanIntakeFromSyncedIssues().catch((err) =>
      logger.warn({ err }, "intake scan after incremental sync failed")
    );

    logger.info({ runId: run.id, ...result, jql }, "jira incremental sync complete");
    return { runId: run.id, ...result };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await completeSyncRun(run.id, {
      status: "FAILED",
      issuesSynced: 0,
      issuesSkipped: 0,
      errors: 1,
      errorMessage: message,
    });
    throw err;
  } finally {
    setJiraSyncRunning(false);
  }
}

export async function syncSingleJiraIssueFromWebhook(
  jiraKey: string
): Promise<void> {
  const issue = await fetchJiraIssueByKey(jiraKey);
  if (!issue) return;
  await processIssue(issue);
}

export async function syncSingleJiraIssueFromWebhookWithRetry(
  jiraKey: string
): Promise<void> {
  await withRetry(() => syncSingleJiraIssueFromWebhook(jiraKey), {
    maxAttempts: 2,
    baseDelayMs: 500,
    maxDelayMs: 3000,
    context: { operation: "jira-sync-webhook", jiraKey },
  });
}

export { getJiraIssueStats } from "./issueRepository";
export { getLatestSyncRun, isJiraSyncRunning } from "./syncState";
