import { getDb } from "../../jira-intake/sqliteStore";
import { getActiveOrganizationId } from "../../organization/context";
import { prisma } from "../../db/client";

export interface PipelineCompletionSettings {
  completionStatusName: string;
  attachPrdComment: boolean;
  attachQaComment: boolean;
  attachEngineeringComment: boolean;
  attachRcaComment: boolean;
  updateDescription: boolean;
  attachJsonArtifact: boolean;
}

export interface PipelineIntakeMapping {
  boardId: string;
  aiWorkerColumnName: string;
  aiWorkerStatuses: string[];
  referenceColumnNames: string[];
  referenceStatuses: string[];
  completionSettings: PipelineCompletionSettings;
}

const DEFAULT_COMPLETION: PipelineCompletionSettings = {
  completionStatusName:
    process.env.PIPELINE_COMPLETION_STATUS?.trim() || "Done",
  attachPrdComment: true,
  attachQaComment: true,
  attachEngineeringComment: true,
  attachRcaComment: true,
  updateDescription: true,
  attachJsonArtifact: false,
};

function parseList(raw: string | undefined, fallback: string[]): string[] {
  if (!raw?.trim()) return fallback;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function defaultStatuses(): string[] {
  return parseList(process.env.PIPELINE_JIRA_AI_WORKER_STATUSES, ["AI Worker"]);
}

function defaultReferenceStatuses(): string[] {
  return parseList(process.env.PIPELINE_JIRA_REFERENCE_STATUSES, [
    "Done",
    "Resolved",
    "Closed",
  ]);
}

const orgIntakeCache = new Map<string, PipelineIntakeMapping>();

function parseStringListJson(raw: unknown): string[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) {
      return parsed.map(String).map((s) => s.trim()).filter(Boolean);
    }
  } catch {
    /* ignore */
  }
  return [];
}

function parseStatusesJson(raw: unknown): string[] {
  if (!raw) return defaultStatuses();
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed) && parsed.length) {
      return parsed.map(String).filter(Boolean);
    }
  } catch {
    /* keep defaults */
  }
  return defaultStatuses();
}

function parseCompletionJson(raw: unknown): PipelineCompletionSettings {
  if (!raw) return { ...DEFAULT_COMPLETION };
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return { ...DEFAULT_COMPLETION, ...(parsed as Partial<PipelineCompletionSettings>) };
  } catch {
    return { ...DEFAULT_COMPLETION };
  }
}

function buildMappingFromParts(input: {
  boardId?: string | null;
  aiWorkerColumnName?: string | null;
  aiWorkerStatusesJson?: unknown;
  referenceColumnNamesJson?: unknown;
  referenceStatusesJson?: unknown;
  completionSettingsJson?: unknown;
}): PipelineIntakeMapping {
  const envBoardId = process.env.PIPELINE_JIRA_BOARD_ID?.trim() || "";
  return {
    boardId: input.boardId?.trim() || envBoardId,
    aiWorkerColumnName: input.aiWorkerColumnName?.trim() || "",
    aiWorkerStatuses: parseStatusesJson(input.aiWorkerStatusesJson),
    referenceColumnNames: parseStringListJson(input.referenceColumnNamesJson),
    referenceStatuses: parseStringListJson(input.referenceStatusesJson),
    completionSettings: parseCompletionJson(input.completionSettingsJson),
  };
}

/** Load board/column mapping from Postgres for the active org (multi-tenant). */
export async function warmOrganizationIntakeMapping(
  organizationId: string
): Promise<void> {
  const row = await prisma.organizationJiraConfig.findUnique({
    where: { organizationId },
    select: {
      boardId: true,
      aiWorkerColumnName: true,
      aiWorkerStatusesJson: true,
      referenceColumnNamesJson: true,
      referenceStatusesJson: true,
      completionSettingsJson: true,
    },
  });
  if (!row) {
    orgIntakeCache.delete(organizationId);
    return;
  }

  orgIntakeCache.set(organizationId, buildMappingFromParts(row));
}

export function clearOrganizationIntakeMapping(organizationId: string): void {
  orgIntakeCache.delete(organizationId);
}

export function getPipelineIntakeMapping(): PipelineIntakeMapping {
  const orgId = getActiveOrganizationId();
  if (orgId && orgIntakeCache.has(orgId)) {
    return orgIntakeCache.get(orgId)!;
  }

  const row = getDb()
    .prepare(
      `SELECT board_id, ai_worker_column_name, ai_worker_statuses_json, completion_settings_json
       FROM pipeline_jira_credentials WHERE singleton_id = 1`
    )
    .get() as
    | {
        board_id: string | null;
        ai_worker_column_name: string | null;
        ai_worker_statuses_json: string | null;
        completion_settings_json: string | null;
      }
    | undefined;

  return buildMappingFromParts({
    boardId: row?.board_id,
    aiWorkerColumnName: row?.ai_worker_column_name,
    aiWorkerStatusesJson: row?.ai_worker_statuses_json,
    completionSettingsJson: row?.completion_settings_json,
  });
}

export function getPipelineCompletionSettings(): PipelineCompletionSettings {
  return getPipelineIntakeMapping().completionSettings;
}

export function savePipelineCompletionSettings(
  settings: Partial<PipelineCompletionSettings>
): PipelineCompletionSettings {
  const existing = getPipelineIntakeMapping();
  const merged = { ...existing.completionSettings, ...settings };
  const now = new Date().toISOString();

  getDb()
    .prepare(
      `UPDATE pipeline_jira_credentials SET completion_settings_json = @json, updated_at = @now
       WHERE singleton_id = 1`
    )
    .run({ json: JSON.stringify(merged), now });

  return merged;
}

export function getPipelineIntakeStatuses(): string[] {
  const statuses = getPipelineIntakeMapping().aiWorkerStatuses;
  return statuses.length ? statuses : defaultStatuses();
}

export function getPipelineReferenceStatuses(): string[] {
  return getPipelineIntakeMapping().referenceStatuses;
}

/** Statuses eligible for vector embedding (reference + intake, or env fallback). */
export function getJiraEmbedStatuses(): string[] | null {
  const mapping = getPipelineIntakeMapping();
  const combined = [
    ...new Set([...mapping.aiWorkerStatuses, ...mapping.referenceStatuses]),
  ].filter(Boolean);
  if (combined.length > 0) return combined;

  const envRaw = process.env.JIRA_SYNC_EMBED_STATUSES?.trim();
  if (!envRaw) return null;
  return envRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isPipelineIntakeStatus(statusName: string | undefined): boolean {
  if (!statusName) return false;
  const normalized = statusName.trim().toLowerCase();
  return getPipelineIntakeStatuses().some(
    (s) => s.trim().toLowerCase() === normalized
  );
}

export function isPipelineReferenceStatus(statusName: string | undefined): boolean {
  if (!statusName) return false;
  const normalized = statusName.trim().toLowerCase();
  return getPipelineReferenceStatuses().some(
    (s) => s.trim().toLowerCase() === normalized
  );
}

export function savePipelineIntakeColumn(input: {
  boardId?: string;
  columnName: string;
  statuses: string[];
}): PipelineIntakeMapping {
  const now = new Date().toISOString();
  const existing = getPipelineIntakeMapping();
  const boardId = input.boardId?.trim() || existing.boardId;
  const statuses =
    input.statuses.length > 0 ? input.statuses : defaultStatuses();

  const row = getDb()
    .prepare(`SELECT 1 FROM pipeline_jira_credentials WHERE singleton_id = 1`)
    .get();
  if (!row) {
    throw new Error("Connect Jira first before mapping the intake column");
  }

  getDb()
    .prepare(
      `UPDATE pipeline_jira_credentials SET
        board_id = COALESCE(@boardId, board_id),
        ai_worker_column_name = @columnName,
        ai_worker_statuses_json = @statusesJson,
        updated_at = @now
       WHERE singleton_id = 1`
    )
    .run({
      boardId: boardId || null,
      columnName: input.columnName,
      statusesJson: JSON.stringify(statuses),
      now,
    });

  return {
    ...existing,
    boardId,
    aiWorkerColumnName: input.columnName,
    aiWorkerStatuses: statuses,
  };
}
