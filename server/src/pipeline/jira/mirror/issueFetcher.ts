import { parseDescription } from "../../../jira-intake/descriptionParser";
import { getPipelineJiraClient } from "../client";
import { getPipelineJiraMirrorConfig } from "../config";

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
  "comment",
].join(",");

export interface FetchedMirrorIssue {
  jiraTicketId: string;
  jiraKey: string;
  projectKey: string;
  summary: string;
  description: string;
  issueType: string;
  status: string;
  priority: string | null;
  labels: string[];
  components: string[];
  commentsText: string;
  resolution: string | null;
  jiraUpdatedAt: Date | null;
}

interface JiraComment {
  body?: unknown;
  author?: { displayName?: string };
  created?: string;
}

export async function fetchMirrorIssue(
  jiraKey: string
): Promise<FetchedMirrorIssue | null> {
  const client = getPipelineJiraClient();
  const cfg = getPipelineJiraMirrorConfig();

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

  const fields = issue.fields;
  const status = fields.status as { name?: string } | undefined;
  const issuetype = fields.issuetype as { name?: string } | undefined;
  const priority = fields.priority as { name?: string } | undefined;
  const project = fields.project as { key?: string } | undefined;
  const resolution = fields.resolution as { name?: string } | null | undefined;
  const components = (fields.components as Array<{ name?: string }> | undefined) ?? [];
  const labels = (fields.labels as string[] | undefined) ?? [];

  let commentsText = "";
  try {
    const commentsPayload = (await client.getIssueWithFields<{
      fields?: { comment?: { comments?: JiraComment[] } };
    }>(jiraKey, ["comment"])) as {
      fields?: { comment?: { comments?: JiraComment[] } };
    };
    const comments = commentsPayload.fields?.comment?.comments ?? [];
    commentsText = comments
      .slice(-cfg.maxComments)
      .map((c) => {
        const author = c.author?.displayName ?? "Unknown";
        const body = parseDescription(c.body);
        return `[${author}]: ${body}`;
      })
      .filter(Boolean)
      .join("\n\n");
  } catch {
    /* comments optional */
  }

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
    labels,
    components: components.map((c) => c.name ?? "").filter(Boolean),
    commentsText,
    resolution: resolution?.name ?? null,
    jiraUpdatedAt: updatedRaw ? new Date(updatedRaw) : null,
  };
}

export async function searchMirrorIssueKeys(
  jql: string,
  maxResults: number
): Promise<string[]> {
  const client = getPipelineJiraClient();
  const result = await client.searchIssues<{ key: string }>(jql, {
    fields: ["summary"],
    maxResults: Math.min(maxResults, 100),
  });

  return (result.issues ?? []).map((i) => i.key).filter(Boolean);
}
