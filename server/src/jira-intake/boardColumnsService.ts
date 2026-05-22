import { intakeConfig, validateJiraConfig } from "./config";
import {
  getIntegrationMapping,
  saveIntegrationMapping,
} from "./integrationConfigStore";
import {
  deactivateAiWorkerIssue,
  upsertAiWorkerIssue,
} from "./sqliteStore";
import type { ParsedJiraIssue } from "./jiraEventParser";
import { parseDescription } from "./descriptionParser";
import {
  escapeJqlString,
  getBoardFilterJql,
  jiraFetch,
  searchIssues,
} from "./jiraApiClient";

export interface BoardColumnDto {
  name: string;
  statuses: string[];
}

export async function getBoardColumnsOrdered(): Promise<BoardColumnDto[]> {
  validateJiraConfig();
  const boardId = intakeConfig.jira.boardId;
  const configData = (await jiraFetch(
    `/rest/agile/1.0/board/${boardId}/configuration`
  )) as {
    columnConfig?: {
      columns?: { name?: string; statuses?: { name?: string }[] }[];
    };
  };

  return (configData?.columnConfig?.columns || []).map((col) => ({
    name: col.name || "Unnamed",
    statuses: (col.statuses || [])
      .map((s) => s.name)
      .filter((n): n is string => Boolean(n)),
  }));
}

function mapSearchIssueToParsed(issue: {
  key?: string;
  id?: string | number;
  fields?: Record<string, unknown>;
}): ParsedJiraIssue {
  const fields = issue.fields || {};
  const status = fields.status as { name?: string } | undefined;
  const issuetype = fields.issuetype as { name?: string } | undefined;
  const project = fields.project as { key?: string } | undefined;
  const assignee = fields.assignee as { displayName?: string } | undefined;
  const reporter = fields.reporter as { displayName?: string } | undefined;
  const priority = fields.priority as { name?: string } | undefined;

  return {
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

export async function syncWorkingColumnFromBoard(): Promise<{
  synced: number;
  issueKeys: string[];
}> {
  validateJiraConfig();
  const mapping = getIntegrationMapping();
  const statuses = mapping.workingStatuses;
  if (!statuses.length) {
    throw new Error("Map a working column with at least one Jira status first");
  }

  const boardScope = await getBoardFilterJql();
  const statusClause = statuses
    .map((s) => `"${escapeJqlString(s)}"`)
    .join(", ");
  const jql = `${boardScope} AND status in (${statusClause}) ORDER BY updated DESC`;

  const issueKeys: string[] = [];
  let nextPageToken: string | undefined;

  do {
    const page = await searchIssues(jql, { maxResults: 50, nextPageToken });
    for (const raw of page.issues as Parameters<typeof mapSearchIssueToParsed>[0][]) {
      const parsed = mapSearchIssueToParsed(raw);
      if (!parsed.issueKey) continue;
      upsertAiWorkerIssue(parsed);
      issueKeys.push(parsed.issueKey);
    }
    nextPageToken = page.isLast ? undefined : page.nextPageToken;
  } while (nextPageToken);

  return { synced: issueKeys.length, issueKeys };
}

export async function advanceIssueToNextColumn(
  issueKey: string
): Promise<{ issueKey: string; fromStatus: string; toStatus: string; column: string }> {
  validateJiraConfig();
  const mapping = getIntegrationMapping();
  if (!mapping.nextColumnName) {
    throw new Error("Map a target “next” column in Jira integration settings");
  }

  const columns = await getBoardColumnsOrdered();
  const issue = (await jiraFetch(
    `/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=status`
  )) as { fields?: { status?: { name?: string } } };
  const fromStatus = issue.fields?.status?.name || "";
  if (!fromStatus) throw new Error(`Could not read status for ${issueKey}`);

  const currentIndex = columns.findIndex((col) =>
    col.statuses.some((s) => s.toLowerCase() === fromStatus.toLowerCase())
  );
  if (currentIndex < 0) {
    throw new Error(`Status "${fromStatus}" is not on this board’s column map`);
  }

  const nextIndex =
    mapping.nextColumnName
      ? columns.findIndex(
          (c) => c.name.toLowerCase() === mapping.nextColumnName.toLowerCase()
        )
      : currentIndex + 1;

  if (nextIndex < 0) {
    throw new Error(`Next column "${mapping.nextColumnName}" not found on board`);
  }
  if (nextIndex >= columns.length) {
    throw new Error("Issue is already in the last column on the board");
  }

  const targetColumn = columns[nextIndex];
  const targetStatus = targetColumn.statuses[0];
  if (!targetStatus) {
    throw new Error(`Column "${targetColumn.name}" has no mapped statuses`);
  }

  const transitionsData = (await jiraFetch(
    `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`
  )) as {
    transitions?: { id: string; name?: string; to?: { name?: string } }[];
  };

  const transition = (transitionsData.transitions || []).find(
    (t) => t.to?.name?.toLowerCase() === targetStatus.toLowerCase()
  );
  if (!transition) {
    const available = (transitionsData.transitions || [])
      .map((t) => t.to?.name)
      .filter(Boolean)
      .join(", ");
    throw new Error(
      `No Jira transition to "${targetStatus}". Available targets: ${available || "none"}`
    );
  }

  await jiraFetch(
    `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`,
    {
      method: "POST",
      body: JSON.stringify({ transition: { id: transition.id } }),
    }
  );

  const refreshed = (await jiraFetch(
    `/rest/api/3/issue/${encodeURIComponent(issueKey)}?fields=status,summary,description,issuetype,project,assignee,reporter,priority,labels`
  )) as { key?: string; id?: string | number; fields?: Record<string, unknown> };

  const parsed = mapSearchIssueToParsed(refreshed);
  const stillWorking = mapping.workingStatuses.some(
    (s) => s.toLowerCase() === parsed.statusName.toLowerCase()
  );
  if (stillWorking) {
    upsertAiWorkerIssue(parsed);
  } else {
    deactivateAiWorkerIssue(issueKey);
  }

  return {
    issueKey,
    fromStatus,
    toStatus: parsed.statusName,
    column: targetColumn.name,
  };
}

export function applyColumnMappingFromSelection(input: {
  workingColumnName: string;
  nextColumnName: string;
  columns: BoardColumnDto[];
}): ReturnType<typeof saveIntegrationMapping> {
  const workingCol = input.columns.find(
    (c) => c.name.toLowerCase() === input.workingColumnName.toLowerCase()
  );
  const workingStatuses = workingCol?.statuses.length
    ? workingCol.statuses
    : [input.workingColumnName];

  return saveIntegrationMapping({
    workingColumnName: input.workingColumnName,
    nextColumnName: input.nextColumnName,
    workingStatuses,
  });
}
