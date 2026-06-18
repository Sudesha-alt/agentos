import { getDb } from "../../jira-intake/sqliteStore";

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

export function getPipelineIntakeMapping(): PipelineIntakeMapping {
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

  const envBoardId = process.env.PIPELINE_JIRA_BOARD_ID?.trim() || "";
  let statuses = defaultStatuses();
  if (row?.ai_worker_statuses_json) {
    try {
      const parsed = JSON.parse(row.ai_worker_statuses_json) as string[];
      if (Array.isArray(parsed) && parsed.length) statuses = parsed;
    } catch {
      /* keep defaults */
    }
  }

  let completionSettings = { ...DEFAULT_COMPLETION };
  if (row?.completion_settings_json) {
    try {
      completionSettings = {
        ...DEFAULT_COMPLETION,
        ...(JSON.parse(row.completion_settings_json) as Partial<PipelineCompletionSettings>),
      };
    } catch {
      /* keep defaults */
    }
  }

  return {
    boardId: row?.board_id || envBoardId,
    aiWorkerColumnName: row?.ai_worker_column_name || "",
    aiWorkerStatuses: statuses,
    completionSettings,
  };
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

export function isPipelineIntakeStatus(statusName: string | undefined): boolean {
  if (!statusName) return false;
  const normalized = statusName.trim().toLowerCase();
  return getPipelineIntakeStatuses().some(
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
    boardId,
    aiWorkerColumnName: input.columnName,
    aiWorkerStatuses: statuses,
    completionSettings: existing.completionSettings,
  };
}
