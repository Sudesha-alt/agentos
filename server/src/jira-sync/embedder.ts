import { prisma } from "../db/client";
import { embedder } from "../rag/embedder";
import { vectorStore } from "../rag/vectorStore";
import { logger } from "../utils/logger";
import { shouldEmbedStatus } from "./config";
import type { FetchedJiraIssue } from "./issueFetcher";

export function buildJiraIssueEmbeddingText(
  issue: FetchedJiraIssue,
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
        (c) =>
          `- ${c.sha.slice(0, 8)} ${c.message} (${c.author}, ${c.authoredAt.toISOString().slice(0, 10)})`
      ),
    ].join("\n");
  } catch {
    return "";
  }
}

export async function embedSyncedIssue(
  issue: FetchedJiraIssue,
  gitContext?: string
): Promise<boolean> {
  if (!shouldEmbedStatus(issue.status)) {
    return false;
  }

  const git = gitContext ?? (await fetchGitContext(issue.jiraKey));
  const text = buildJiraIssueEmbeddingText(issue, git || undefined);
  const embedding = await embedder.embed(text);

  await vectorStore.upsert({
    jiraTicketId: issue.jiraTicketId,
    jiraKey: issue.jiraKey,
    contentType: "ticket",
    content: text,
    embedding,
    metadata: {
      source: "jira_sync",
      summary: issue.summary,
      issueType: issue.issueType,
      status: issue.status,
      priority: issue.priority,
      components: issue.components,
      embeddedAt: new Date().toISOString(),
    },
  });

  await prisma.jiraIssue.update({
    where: { jiraKey: issue.jiraKey },
    data: {
      embeddedAt: new Date(),
      gitContext: git || null,
    },
  });

  logger.info({ jiraKey: issue.jiraKey }, "synced jira issue embedded");
  return true;
}
