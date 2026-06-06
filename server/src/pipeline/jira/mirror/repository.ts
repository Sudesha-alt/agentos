import { prisma } from "../../../db/client";
import { embedder } from "../../../rag/embedder";
import { vectorStore } from "../../../rag/vectorStore";
import { logger } from "../../../utils/logger";
import type { FetchedMirrorIssue } from "./issueFetcher";

export function buildMirrorEmbeddingText(
  issue: FetchedMirrorIssue,
  gitContext?: string
): string {
  const parts = [
    `TICKET: ${issue.summary}`,
    `KEY: ${issue.jiraKey}`,
    `TYPE: ${issue.issueType}`,
    `STATUS: ${issue.status}`,
    issue.priority ? `PRIORITY: ${issue.priority}` : "",
    issue.components.length
      ? `COMPONENTS: ${issue.components.join(", ")}`
      : "",
    issue.labels.length ? `LABELS: ${issue.labels.join(", ")}` : "",
    issue.resolution ? `RESOLUTION: ${issue.resolution}` : "",
    `DESCRIPTION: ${issue.description}`,
  ];

  if (issue.commentsText) {
    parts.push(`COMMENTS / FIX NOTES:\n${issue.commentsText}`);
  }
  if (gitContext) {
    parts.push(gitContext);
  }

  return parts.filter(Boolean).join("\n");
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

export async function embedMirroredIssue(
  issue: FetchedMirrorIssue,
  gitContext?: string
): Promise<void> {
  const git = gitContext ?? (await fetchGitContext(issue.jiraKey));
  const text = buildMirrorEmbeddingText(issue, git || undefined);

  const embedding = await embedder.embed(text);

  await vectorStore.upsert({
    jiraTicketId: issue.jiraTicketId,
    jiraKey: issue.jiraKey,
    contentType: "ticket",
    content: text,
    embedding,
    metadata: {
      source: "jira_mirror",
      summary: issue.summary,
      issueType: issue.issueType,
      status: issue.status,
      priority: issue.priority,
      components: issue.components,
      embeddedAt: new Date().toISOString(),
    },
  });

  logger.info({ jiraKey: issue.jiraKey }, "mirrored ticket embedded");
}

export async function upsertMirrorRecord(
  issue: FetchedMirrorIssue,
  gitContext?: string
): Promise<void> {
  const git = gitContext ?? (await fetchGitContext(issue.jiraKey));
  const now = new Date();

  await prisma.jiraMirror.upsert({
    where: { jiraKey: issue.jiraKey },
    create: {
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
    where: { jiraKey: issue.jiraKey },
    data: { embeddedAt: now },
  });
}

export async function getMirrorStats(): Promise<{
  total: number;
  embedded: number;
  byStatus: Record<string, number>;
}> {
  const [total, embedded, rows] = await Promise.all([
    prisma.jiraMirror.count(),
    prisma.jiraMirror.count({ where: { embeddedAt: { not: null } } }),
    prisma.jiraMirror.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
  ]);

  const byStatus: Record<string, number> = {};
  for (const row of rows) {
    byStatus[row.status] = row._count.status;
  }

  return { total, embedded, byStatus };
}
