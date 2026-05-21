import { intakeConfig } from "./config";
import { parseDescription } from "./descriptionParser";
import {
  escapeJqlString,
  getBoardColumnMapping,
  getBoardFilterJql,
  searchIssues,
} from "./jiraApiClient";

function buildTextClause(keyword: string, searchIn: string): string {
  const escaped = escapeJqlString(keyword);
  if (searchIn === "summary") {
    return `summary ~ "${escaped}"`;
  }
  if (searchIn === "both") {
    return `(description ~ "${escaped}" OR summary ~ "${escaped}")`;
  }
  return `description ~ "${escaped}"`;
}

interface MappedIssue {
  key: string;
  id: string;
  summary: string;
  description: string;
  status: string;
  issueType: string;
  projectKey: string;
  assignee: string | null;
  reporter: string | null;
  priority: string | null;
  labels: string[];
  updated: string | null;
}

function mapIssue(issue: {
  key?: string;
  id?: string;
  fields?: Record<string, unknown>;
}): MappedIssue {
  const fields = issue.fields || {};
  const status = fields.status as { name?: string } | undefined;
  const issuetype = fields.issuetype as { name?: string } | undefined;
  const project = fields.project as { key?: string } | undefined;
  const assignee = fields.assignee as { displayName?: string } | undefined;
  const reporter = fields.reporter as { displayName?: string } | undefined;
  const priority = fields.priority as { name?: string } | undefined;

  return {
    key: issue.key || "",
    id: String(issue.id ?? ""),
    summary: String(fields.summary || ""),
    description: parseDescription(fields.description),
    status: status?.name || "Unknown",
    issueType: issuetype?.name || "",
    projectKey: project?.key || "",
    assignee: assignee?.displayName || null,
    reporter: reporter?.displayName || null,
    priority: priority?.name || null,
    labels: Array.isArray(fields.labels) ? (fields.labels as string[]) : [],
    updated: (fields.updated as string) || null,
  };
}

function groupBySection(
  issues: MappedIssue[],
  columnMapping: Map<string, string>
) {
  const sectionsMap = new Map<
    string,
    { status: string; columnLabel: string; issues: MappedIssue[] }
  >();

  for (const issue of issues) {
    const status = issue.status;
    const columnLabel = columnMapping.get(status.toLowerCase()) || status;

    if (!sectionsMap.has(status)) {
      sectionsMap.set(status, { status, columnLabel, issues: [] });
    }
    sectionsMap.get(status)!.issues.push(issue);
  }

  return Array.from(sectionsMap.values()).sort((a, b) =>
    a.columnLabel.localeCompare(b.columnLabel)
  );
}

export async function searchBoardByKeyword(
  keyword: string,
  searchIn = "description"
) {
  const boardScope = await getBoardFilterJql();
  const textClause = buildTextClause(keyword, searchIn);
  const jql = `${boardScope} AND ${textClause} ORDER BY updated DESC`;

  const [searchResult, columnMapping] = await Promise.all([
    searchIssues(jql),
    getBoardColumnMapping(),
  ]);

  const issues = (searchResult.issues as Parameters<typeof mapIssue>[0][]).map(
    mapIssue
  );
  const sections = groupBySection(issues, columnMapping);

  return {
    keyword,
    searchIn,
    boardId: Number(intakeConfig.jira.boardId) || intakeConfig.jira.boardId,
    jql,
    total: issues.length,
    isLast: searchResult.isLast,
    sections,
  };
}
