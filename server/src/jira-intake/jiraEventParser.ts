import { parseDescription } from "./descriptionParser";

export interface ParsedJiraIssue {
  webhookEvent?: string;
  issueKey: string;
  issueId: string;
  summary: string;
  description: string;
  statusName: string;
  issueType: string;
  projectKey: string;
  assignee: string | null;
  reporter: string | null;
  priority: string | null;
  labels: string[];
}

export function parseJiraWebhook(body: unknown): ParsedJiraIssue | null {
  if (!body || typeof body !== "object") return null;
  const payload = body as { issue?: { key?: string; id?: string | number; fields?: Record<string, unknown> }; webhookEvent?: string };
  if (!payload.issue) return null;

  const issue = payload.issue;
  const fields = (issue.fields || {}) as Record<string, unknown>;

  const status = fields.status as { name?: string } | undefined;
  const issuetype = fields.issuetype as { name?: string } | undefined;
  const project = fields.project as { key?: string } | undefined;
  const assignee = fields.assignee as { displayName?: string } | undefined;
  const reporter = fields.reporter as { displayName?: string } | undefined;
  const priority = fields.priority as { name?: string } | undefined;

  return {
    webhookEvent: payload.webhookEvent,
    issueKey: issue.key || "",
    issueId: String(issue.id ?? ""),
    summary: String(fields.summary || ""),
    description: parseDescription(fields.description),
    statusName: status?.name || "",
    issueType: issuetype?.name || "",
    projectKey: project?.key || "",
    assignee: assignee?.displayName || null,
    reporter: reporter?.displayName || null,
    priority: priority?.name || null,
    labels: Array.isArray(fields.labels) ? (fields.labels as string[]) : [],
  };
}
