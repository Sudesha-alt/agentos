import { prisma } from "../db/client";
import { logger } from "../utils/logger";
import { upsertJiraIssueRecord } from "./issueRepository";

/** Copy legacy JiraMirror rows into JiraIssue (idempotent). */
export async function migrateJiraMirrorToJiraIssue(): Promise<number> {
  const mirrors = await prisma.jiraMirror.findMany({ take: 5000 });
  let migrated = 0;

  for (const m of mirrors) {
    const labels = Array.isArray(m.labels) ? (m.labels as string[]) : [];
    const components = Array.isArray(m.components) ? (m.components as string[]) : [];

    await upsertJiraIssueRecord(
      {
        jiraTicketId: m.jiraTicketId,
        jiraKey: m.jiraKey,
        projectKey: m.projectKey,
        summary: m.summary,
        description: m.description,
        issueType: m.issueType,
        status: m.status,
        priority: m.priority,
        reporter: null,
        assignee: null,
        labels,
        components,
        commentsText: m.commentsText ?? "",
        resolution: m.resolution,
        jiraUpdatedAt: m.jiraUpdatedAt,
      },
      { embeddedAt: m.embeddedAt ?? undefined }
    );
    migrated += 1;
  }

  if (migrated > 0) {
    logger.info({ migrated }, "migrated JiraMirror rows to JiraIssue");
  }

  return migrated;
}
