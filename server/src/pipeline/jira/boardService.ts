import { parseDescription } from "../../jira-intake/descriptionParser";
import { ValidationError } from "../../utils/errors";
import {
  getActivePipelineJiraCredentials,
  validatePipelineJiraConfig,
} from "./credentialsStore";
import { pipelineJiraFetch } from "./client";
import { getPipelineIntakeMapping, getPipelineIntakeStatuses } from "./intakeConfig";

function ensurePipelineReady(): void {
  try {
    validatePipelineJiraConfig();
  } catch (err) {
    throw new ValidationError(
      err instanceof Error ? err.message : "Pipeline Jira not configured"
    );
  }
}

export interface BoardColumnDto {
  name: string;
  statuses: string[];
}

export interface IntakeTicketDto {
  key: string;
  id: string;
  summary: string;
  description: string;
  status: string;
  issueType: string;
  projectKey: string;
  priority: string | null;
  updated: string | null;
}

export interface JiraProjectOption {
  id: string;
  key: string;
  name: string;
}

export interface JiraBoardOption {
  id: number;
  name: string;
  projectKey: string;
  projectName: string;
  type: string;
}

export async function listJiraProjects(): Promise<JiraProjectOption[]> {
  ensurePipelineReady();
  const data = (await pipelineJiraFetch(
    "/rest/api/3/project/search?maxResults=50&orderBy=lastIssueUpdatedTime"
  )) as {
    values?: { id?: string; key?: string; name?: string }[];
  };

  return (data.values ?? [])
    .map((p) => ({
      id: String(p.id ?? ""),
      key: String(p.key ?? ""),
      name: String(p.name ?? p.key ?? ""),
    }))
    .filter((p) => p.key);
}

export async function listJiraBoards(projectKey?: string): Promise<JiraBoardOption[]> {
  ensurePipelineReady();
  const params = new URLSearchParams({ maxResults: "50" });
  if (projectKey?.trim()) {
    params.set("projectKeyOrId", projectKey.trim());
  }

  const data = (await pipelineJiraFetch(
    `/rest/agile/1.0/board?${params.toString()}`
  )) as {
    values?: {
      id?: number;
      name?: string;
      type?: string;
      location?: { projectKey?: string; projectName?: string };
    }[];
  };

  return (data.values ?? [])
    .map((b) => ({
      id: Number(b.id),
      name: String(b.name ?? `Board ${b.id}`),
      projectKey: String(b.location?.projectKey ?? ""),
      projectName: String(b.location?.projectName ?? ""),
      type: String(b.type ?? ""),
    }))
    .filter((b) => Number.isFinite(b.id));
}

export async function getBoardColumnsOrdered(boardIdOverride?: string): Promise<BoardColumnDto[]> {
  ensurePipelineReady();
  const { boardId: mappedId } = getPipelineIntakeMapping();
  const boardId = (boardIdOverride ?? mappedId)?.trim();
  if (!boardId) {
    throw new ValidationError(
      "Board ID is not set — choose a project and board in Pipeline settings first."
    );
  }
  if (!/^\d+$/.test(boardId)) {
    throw new ValidationError(
      `Invalid board ID "${boardId}" — use the board dropdown (numeric id), not the project key.`
    );
  }

  const configData = (await pipelineJiraFetch(
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

function escapeJqlString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function mapIssue(raw: {
  key?: string;
  id?: string | number;
  fields?: Record<string, unknown>;
}): IntakeTicketDto {
  const fields = raw.fields || {};
  const status = fields.status as { name?: string } | undefined;
  const issuetype = fields.issuetype as { name?: string } | undefined;
  const project = fields.project as { key?: string } | undefined;
  const priority = fields.priority as { name?: string } | undefined;

  return {
    key: raw.key || "",
    id: String(raw.id ?? ""),
    summary: String(fields.summary || ""),
    description: parseDescription(fields.description),
    status: status?.name || "",
    issueType: issuetype?.name || "",
    projectKey: project?.key || "",
    priority: priority?.name ?? null,
    updated: (fields.updated as string) || null,
  };
}

export async function listTicketsByStatuses(statuses: string[]): Promise<{
  items: IntakeTicketDto[];
  jql: string;
}> {
  validatePipelineJiraConfig();
  if (!statuses.length) {
    return { items: [], jql: "" };
  }

  const clauses: string[] = [];
  const projectKeys = getActivePipelineJiraCredentials().projectKeys;
  if (projectKeys.length === 1) {
    clauses.push(`project = "${escapeJqlString(projectKeys[0])}"`);
  } else if (projectKeys.length > 1) {
    const list = projectKeys.map((k) => `"${escapeJqlString(k)}"`).join(", ");
    clauses.push(`project in (${list})`);
  }

  const statusList = statuses.map((s) => `"${escapeJqlString(s)}"`).join(", ");
  clauses.push(`status in (${statusList})`);

  const jql = `${clauses.join(" AND ")} ORDER BY updated DESC`;

  const result = (await pipelineJiraFetch("/rest/api/3/search/jql", {
    method: "POST",
    body: JSON.stringify({
      jql,
      maxResults: 100,
      fields: [
        "summary",
        "description",
        "status",
        "issuetype",
        "project",
        "priority",
        "updated",
      ],
    }),
  })) as { issues?: Parameters<typeof mapIssue>[0][] };

  const items = (result.issues ?? [])
    .map(mapIssue)
    .filter((i) => i.key);

  return { items, jql };
}

export async function listIntakeColumnTickets(): Promise<{
  items: IntakeTicketDto[];
  jql: string;
}> {
  const statuses = getPipelineIntakeStatuses();
  if (!statuses.length) {
    throw new Error("Configure the AI Worker intake column first");
  }
  return listTicketsByStatuses(statuses);
}

export function resolveIntakeStatusesForColumn(
  columnName: string,
  columns: BoardColumnDto[]
): string[] {
  const col = columns.find(
    (c) => c.name.toLowerCase() === columnName.trim().toLowerCase()
  );
  return col?.statuses.length ? col.statuses : [columnName.trim()];
}

export function resolveReferenceStatusesForColumns(
  columnNames: string[],
  columns: BoardColumnDto[]
): string[] {
  const statuses = new Set<string>();
  for (const name of columnNames) {
    for (const status of resolveIntakeStatusesForColumn(name, columns)) {
      statuses.add(status);
    }
  }
  return [...statuses];
}
