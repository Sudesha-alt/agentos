import { intakeConfig, validateJiraConfig } from "./config";

function getAuthHeader(): string {
  const { email, apiToken } = intakeConfig.jira;
  const token = Buffer.from(`${email}:${apiToken}`).toString("base64");
  return `Basic ${token}`;
}

export async function jiraFetch(
  path: string,
  options: RequestInit = {}
): Promise<unknown> {
  validateJiraConfig();
  const url = `${intakeConfig.jira.baseUrl}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: getAuthHeader(),
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const obj = data as {
      errorMessages?: string[];
      message?: string;
    } | null;
    const msg =
      obj && typeof obj === "object" && obj.errorMessages?.length
        ? obj.errorMessages.join("; ")
        : obj && typeof obj === "object" && obj.message
          ? obj.message
          : text || res.statusText;
    const err = new Error(`Jira API ${res.status}: ${msg}`) as Error & {
      status?: number;
      body?: unknown;
    };
    err.status = res.status;
    err.body = data;
    throw err;
  }

  return data;
}

export function escapeJqlString(value: string): string {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export async function getBoardFilterJql(): Promise<string> {
  const boardId = intakeConfig.jira.boardId;
  try {
    const board = (await jiraFetch(
      `/rest/agile/1.0/board/${boardId}`
    )) as { location?: { projectKey?: string } };
    if (board?.location?.projectKey) {
      return `project = "${escapeJqlString(board.location.projectKey)}"`;
    }
  } catch {
    // fall through
  }

  try {
    const configData = (await jiraFetch(
      `/rest/agile/1.0/board/${boardId}/configuration`
    )) as { filter?: { id?: string } };
    const filterId = configData?.filter?.id;
    if (filterId) {
      const filter = (await jiraFetch(`/rest/api/3/filter/${filterId}`)) as {
        jql?: string;
      };
      if (filter?.jql) return `(${filter.jql})`;
    }
  } catch {
    // fall through
  }

  return `board = ${boardId}`;
}

export async function searchIssues(
  jql: string,
  { maxResults = 100, nextPageToken }: { maxResults?: number; nextPageToken?: string } = {}
): Promise<{
  issues: unknown[];
  total: number;
  isLast?: boolean;
  nextPageToken?: string;
}> {
  const body: Record<string, unknown> = {
    jql,
    maxResults,
    fields: [
      "summary",
      "description",
      "status",
      "issuetype",
      "project",
      "assignee",
      "reporter",
      "priority",
      "labels",
      "updated",
    ],
  };
  if (nextPageToken) body.nextPageToken = nextPageToken;

  const result = (await jiraFetch("/rest/api/3/search/jql", {
    method: "POST",
    body: JSON.stringify(body),
  })) as {
    issues?: unknown[];
    total?: number;
    isLast?: boolean;
    nextPageToken?: string;
  };

  return {
    issues: result.issues || [],
    total: result.total ?? (result.issues || []).length,
    isLast: result.isLast,
    nextPageToken: result.nextPageToken,
  };
}

export async function getBoardColumnMapping(): Promise<Map<string, string>> {
  const boardId = intakeConfig.jira.boardId;
  const mapping = new Map<string, string>();

  try {
    const configData = (await jiraFetch(
      `/rest/agile/1.0/board/${boardId}/configuration`
    )) as {
      columnConfig?: { columns?: { name?: string; statuses?: { name?: string }[] }[] };
    };
    for (const column of configData?.columnConfig?.columns || []) {
      const label = column.name || "";
      for (const status of column.statuses || []) {
        if (status.name) mapping.set(status.name.toLowerCase(), label);
      }
    }
  } catch {
    // optional enrichment
  }

  return mapping;
}
