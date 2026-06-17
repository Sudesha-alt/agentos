import { prisma } from "../../../db/client";
import { embedTicketFields } from "../../../rag/ticketEmbedService";
import { ticketFieldsFromFetched } from "../../../rag/ticketEmbeddingText";
import type { FetchedJiraIssue } from "../../../jira-sync/issueFetcher";
import { logger } from "../../../utils/logger";
import { requireActiveOrganizationId } from "../../../organization/orgScope";
import type { FetchedMirrorIssue } from "./issueFetcher";

export async function embedMirroredIssue(
  issue: FetchedMirrorIssue,
  gitContext?: string
): Promise<void> {
  const git = gitContext ?? (await fetchGitContext(issue.jiraKey));
  const fields = ticketFieldsFromFetched(issue as FetchedJiraIssue, git || undefined);
  await embedTicketFields(issue.jiraTicketId, fields);
  logger.info({ jiraKey: issue.jiraKey }, "mirrored ticket embedded");
}

async function fetchGitContext(jiraKey: string): Promise<string> {
  try {
    const commits = await prisma.commitHistory.findMany({
      where: { jiraKey },
      orderBy: { authoredAt: "desc" },
      take: 5,
    });
    if (!commits.length) return "";
    return [
      "RELATED COMMITS:",
      ...commits.map(
        (c: { sha: string; message: string; author: string; authoredAt: Date }) =>
          `- ${c.sha.slice(0, 8)} ${c.message} (${c.author}, ${c.authoredAt.toISOString().slice(0, 10)})`
      ),
    ].join("\n");
  } catch {
    return "";
  }
}

export async function upsertMirrorRecord(
  issue: FetchedMirrorIssue,
  gitContext?: string
): Promise<void> {
  const git = gitContext ?? (await fetchGitContext(issue.jiraKey));
  const now = new Date();

  const organizationId = requireActiveOrganizationId();
  await prisma.jiraMirror.upsert({
    where: {
      organizationId_jiraKey: { organizationId, jiraKey: issue.jiraKey },
    },
    create: {
      organizationId,
      jiraTicketId: issue.jiraTicketId,
      jiraKey: issue.jiraKey,
      projectKey: issue.projectKey,
      summary: issue.summary,
      description: issue.description,
      issueType: issue.issueType,
      status: issue.status,
      priority: issue.priority,
      labels: issue.labels,
      components: issue.components,
      commentsText: issue.commentsText || null,
      resolution: issue.resolution,
      gitContext: git || null,
      jiraUpdatedAt: issue.jiraUpdatedAt,
      updatedAt: now,
    },
    update: {
      jiraTicketId: issue.jiraTicketId,
      projectKey: issue.projectKey,
      summary: issue.summary,
      description: issue.description,
      issueType: issue.issueType,
      status: issue.status,
      priority: issue.priority,
      labels: issue.labels,
      components: issue.components,
      commentsText: issue.commentsText || null,
      resolution: issue.resolution,
      gitContext: git || null,
      jiraUpdatedAt: issue.jiraUpdatedAt,
      updatedAt: now,
    },
  });

  await embedMirroredIssue(issue, git || undefined);

  await prisma.jiraMirror.update({
    where: {
      organizationId_jiraKey: { organizationId, jiraKey: issue.jiraKey },
    },
    data: { embeddedAt: now },
  });
}

export async function getMirrorStats(organizationId?: string): Promise<{
  total: number;
  embedded: number;
  byStatus: Record<string, number>;
}> {
  const org = organizationId ?? requireActiveOrganizationId();
  const [total, embedded, rows] = await Promise.all([
    prisma.jiraMirror.count({ where: { organizationId: org } }),
    prisma.jiraMirror.count({
      where: { organizationId: org, embeddedAt: { not: null } },
    }),
    prisma.jiraMirror.groupBy({
      by: ["status"],
      where: { organizationId: org },
      _count: { status: true },
    }),
  ]);

  const byStatus: Record<string, number> = {};
  for (const row of rows) {
    byStatus[row.status] = row._count.status;
  }

  return { total, embedded, byStatus };
}
