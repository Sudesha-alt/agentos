import { getDb } from "./sqliteStore";
import { intakeConfig } from "./config";

export interface JiraIntegrationMapping {
  workingColumnName: string;
  nextColumnName: string;
  workingStatuses: string[];
  updatedAt: string | null;
}

const DEFAULT_MAPPING: JiraIntegrationMapping = {
  workingColumnName: "",
  nextColumnName: "",
  workingStatuses: [...intakeConfig.aiWorkerStatuses],
  updatedAt: null,
};

export function getIntegrationMapping(): JiraIntegrationMapping {
  const row = getDb()
    .prepare(
      `SELECT working_column_name, next_column_name, working_statuses_json, updated_at
       FROM jira_integration_config WHERE singleton_id = 1`
    )
    .get() as
    | {
        working_column_name: string | null;
        next_column_name: string | null;
        working_statuses_json: string;
        updated_at: string;
      }
    | undefined;

  if (!row) return { ...DEFAULT_MAPPING };

  let statuses: string[] = [];
  try {
    statuses = JSON.parse(row.working_statuses_json) as string[];
  } catch {
    statuses = [...intakeConfig.aiWorkerStatuses];
  }

  return {
    workingColumnName: row.working_column_name || "",
    nextColumnName: row.next_column_name || "",
    workingStatuses: statuses.length ? statuses : [...intakeConfig.aiWorkerStatuses],
    updatedAt: row.updated_at,
  };
}

export function saveIntegrationMapping(input: {
  workingColumnName: string;
  nextColumnName: string;
  workingStatuses: string[];
}): JiraIntegrationMapping {
  const now = new Date().toISOString();
  const statuses =
    input.workingStatuses.length > 0
      ? input.workingStatuses
      : [...intakeConfig.aiWorkerStatuses];

  getDb()
    .prepare(
      `INSERT INTO jira_integration_config (
        singleton_id, working_column_name, next_column_name, working_statuses_json, updated_at
      ) VALUES (1, @workingColumn, @nextColumn, @statusesJson, @now)
      ON CONFLICT(singleton_id) DO UPDATE SET
        working_column_name = excluded.working_column_name,
        next_column_name = excluded.next_column_name,
        working_statuses_json = excluded.working_statuses_json,
        updated_at = excluded.updated_at`
    )
    .run({
      workingColumn: input.workingColumnName,
      nextColumn: input.nextColumnName,
      statusesJson: JSON.stringify(statuses),
      now,
    });

  intakeConfig.aiWorkerStatuses = statuses;

  return {
    workingColumnName: input.workingColumnName,
    nextColumnName: input.nextColumnName,
    workingStatuses: statuses,
    updatedAt: now,
  };
}

export function getTrackedWorkingStatuses(): string[] {
  const mapping = getIntegrationMapping();
  return mapping.workingStatuses.length
    ? mapping.workingStatuses
    : intakeConfig.aiWorkerStatuses;
}
