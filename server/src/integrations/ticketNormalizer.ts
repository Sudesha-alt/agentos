import type { NormalizedTicket } from "../types/ticket";

interface JiraComponent {
  name: string;
}

interface JiraIssueFields {
  summary?: string;
  description?: string;
  issuetype?: { name?: string };
  priority?: { name?: string };
  reporter?: { displayName?: string };
  assignee?: { displayName?: string } | null;
  labels?: string[];
  customfield_10014?: string | null;
  customfield_10016?: number | null;
  components?: JiraComponent[];
  created: string;
  project?: { key?: string };
}

interface JiraIssue {
  id: string;
  key: string;
  fields: JiraIssueFields;
}

export interface JiraWebhookPayload {
  webhookEvent?: string;
  issue: JiraIssue;
}

export function normalizeTicket(payload: JiraWebhookPayload): NormalizedTicket {
  const issue = payload.issue;
  const fields = issue.fields;

  return {
    jiraTicketId: issue.id,
    jiraKey: issue.key,
    summary: fields.summary?.trim() ?? "",
    description: stripJiraMarkdown(fields.description ?? ""),
    issueType: fields.issuetype?.name ?? "Story",
    priority: fields.priority?.name ?? "Medium",
    reporter: fields.reporter?.displayName ?? "Unknown",
    assignee: fields.assignee?.displayName ?? null,
    labels: fields.labels ?? [],
    epicLink: fields.customfield_10014 ?? null,
    storyPoints: fields.customfield_10016 ?? null,
    components: fields.components?.map((c) => c.name) ?? [],
    createdAt: new Date(fields.created),
    projectKey: fields.project?.key ?? "",
  };
}

function stripJiraMarkdown(text: string): string {
  return text
    .replace(/\{[^}]+\}/g, "")
    .replace(/!image[^!]+!/g, "")
    .replace(/\[([^\]]+)\|[^\]]+\]/g, "$1")
    .trim();
}
