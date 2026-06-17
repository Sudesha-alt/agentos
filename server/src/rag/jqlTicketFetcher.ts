import { searchIssues } from "../jira-intake/jiraApiClient";
import { logger } from "../utils/logger";

export interface JqlTicketHit {
  jiraKey: string;
  summary: string;
  status: string;
  issueType: string;
  source: "jql";
}

export async function fetchTicketsByJql(
  jql: string,
  limit = 12
): Promise<JqlTicketHit[]> {
  try {
    const page = await searchIssues<{ key: string; fields: Record<string, unknown> }>(jql, {
      maxResults: limit,
    });
    return page.issues.map((issue) => {
      const fields = issue.fields ?? {};
      const status = fields.status as { name?: string } | undefined;
      const issuetype = fields.issuetype as { name?: string } | undefined;
      return {
        jiraKey: issue.key,
        summary: String(fields.summary ?? ""),
        status: status?.name ?? "Unknown",
        issueType: issuetype?.name ?? "Task",
        source: "jql" as const,
      };
    });
  } catch (err) {
    logger.warn({ err, jql }, "JQL ticket fetch failed");
    return [];
  }
}

export async function fetchJqlRelatedTickets(
  jqlQueries: string[],
  limitPerQuery = 8
): Promise<JqlTicketHit[]> {
  const byKey = new Map<string, JqlTicketHit>();
  for (const jql of jqlQueries) {
    const hits = await fetchTicketsByJql(jql, limitPerQuery);
    for (const hit of hits) {
      if (!byKey.has(hit.jiraKey)) byKey.set(hit.jiraKey, hit);
    }
  }
  return [...byKey.values()];
}
