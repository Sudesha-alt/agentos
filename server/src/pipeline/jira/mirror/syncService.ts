import { logger } from "../../../utils/logger";
import {
  getPipelineJiraMirrorConfig,
  mirrorEligibleIssueType,
  mirrorEligibleStatus,
} from "../config";
import { fetchMirrorIssue, searchMirrorIssueKeys } from "./issueFetcher";
import { buildMirrorBackfillJql } from "./jql";
import { getMirrorStats, upsertMirrorRecord } from "./repository";

export async function syncMirroredIssue(jiraKey: string): Promise<{
  synced: boolean;
  reason?: string;
}> {
  const cfg = getPipelineJiraMirrorConfig();
  const fetched = await fetchMirrorIssue(jiraKey);
  if (!fetched) {
    return { synced: false, reason: "issue_not_found" };
  }

  if (!mirrorEligibleStatus(fetched.status)) {
    return { synced: false, reason: "status_not_eligible" };
  }

  if (!mirrorEligibleIssueType(fetched.issueType)) {
    return { synced: false, reason: "issue_type_not_eligible" };
  }

  if (fetched.description.length < cfg.minDescriptionLength) {
    return { synced: false, reason: "description_too_short" };
  }

  await upsertMirrorRecord(fetched);
  logger.info({ jiraKey }, "jira mirror synced");
  return { synced: true };
}

export async function runMirrorBackfill(options: {
  projectKeys?: string[];
  maxIssues?: number;
}): Promise<{
  processed: number;
  synced: number;
  skipped: number;
  errors: number;
}> {
  const maxIssues = options.maxIssues ?? 200;
  const jql = buildMirrorBackfillJql(options.projectKeys);
  const keys = await searchMirrorIssueKeys(jql, maxIssues);
  let processed = 0;
  let synced = 0;
  let skipped = 0;
  let errors = 0;

  for (const key of keys) {
    processed += 1;
    try {
      const result = await syncMirroredIssue(key);
      if (result.synced) synced += 1;
      else skipped += 1;
    } catch (err) {
      errors += 1;
      logger.warn({ jiraKey: key, err }, "mirror backfill issue failed");
    }
  }

  logger.info(
    { processed, synced, skipped, errors, jql },
    "jira mirror backfill complete"
  );

  return { processed, synced, skipped, errors };
}

export { getMirrorStats };
