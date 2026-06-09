import { parseDescription } from "../jira-intake/descriptionParser";
import { getPipelineJiraClient } from "../pipeline/jira/client";
import { getJiraSyncConfig } from "./config";

const ISSUE_FIELDS = [
  "summary",
  "description",
  "status",
  "issuetype",
  "priority",
  "labels",
  "components",
  "resolution",
  "updated",
  "created",
  "project",
  "reporter",
  "assignee",
  "comment",
].join(",");

export interface FetchedJiraIssue {
  jiraTicketId: string;
  jiraKey: string;
  projectKey: string;
  summary: string;
  description: string;
  issueType: string;
  status: string;
  priority: string | null;
  reporter: string | null;
  assignee: string | null;
  labels: string[];
  components: string[];
  commentsText: string;
  resolution: string | null;
  jiraUpdatedAt: Date | null;
  rawPayload?: Record<string, unknown>;
}

interface JiraComment {
  body?: unknown;
  author?: { displayName?: string };
}

export async function fetchJiraIssueByKey(
  jiraKey: string
): Promise<FetchedJiraIssue | null> {
  const client = getPipelineJiraClient();
  const cfg = getJiraSyncConfig();

  const issue = (await client.getIssueWithFields<{
    id: string;
    key: string;
    fields: Record<string, unknown>;
  }>(jiraKey, ISSUE_FIELDS.split(","))) as {
    id: string;
    key: string;
    fields: Record<string, unknown>;
  };

  if (!issue?.key) return null;
  return mapJiraApiIssue(issue, cfg.maxComments);
}

export function mapJiraApiIssue(
  issue: { id: string; key: string; fields: Record<string, unknown> },
  maxComments = 15
): FetchedJiraIssue {
  const fields = issue.fields;
  const status = fields.status as { name?: string } | undefined;
  const issuetype = fields.issuetype as { name?: string } | undefined;
  const priority = fields.priority as { name?: string } | undefined;
  const project = fields.project as { key?: string } | undefined;
  const resolution = fields.resolution as { name?: string } | null | undefined;
  const reporter = fields.reporter as { displayName?: string } | undefined;
  const assignee = fields.assignee as { displayName?: string } | null | undefined;
  const components = (fields.components as Array<{ name?: string }> | undefined) ?? [];
  const labels = (fields.labels as string[] | undefined) ?? [];
  const commentField = fields.comment as { comments?: JiraComment[] } | undefined;

  const commentsText = (commentField?.comments ?? [])
    .slice(-maxComments)
    .map((c) => {
      const author = c.author?.displayName ?? "Unknown";
      const body = parseDescription(c.body);
      return `[${author}]: ${body}`;
    })
    .filter(Boolean)
    .join("\n\n");

  const updatedRaw = fields.updated as string | undefined;

  return {
    jiraTicketId: issue.id,
    jiraKey: issue.key,
    projectKey: project?.key ?? "",
    summary: String(fields.summary ?? ""),
    description: parseDescription(fields.description),
    issueType: issuetype?.name ?? "Unknown",
    status: status?.name ?? "Unknown",
    priority: priority?.name ?? null,
    reporter: reporter?.displayName ?? null,
    assignee: assignee?.displayName ?? null,
    labels,
    components: components.map((c) => c.name ?? "").filter(Boolean),
    commentsText,
    resolution: resolution?.name ?? null,
    jiraUpdatedAt: updatedRaw ? new Date(updatedRaw) : null,
    rawPayload: { id: issue.id, key: issue.key, fields },
  };
}
