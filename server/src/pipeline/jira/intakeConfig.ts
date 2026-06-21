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

export function parseCompletionJson(raw: unknown): PipelineCompletionSettings {
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

  return buildMappingFromParts({});
}

export function getPipelineCompletionSettings(): PipelineCompletionSettings {
  return getPipelineIntakeMapping().completionSettings;
}

export async function savePipelineCompletionSettings(
  settings: Partial<PipelineCompletionSettings>,
  organizationId?: string
): Promise<PipelineCompletionSettings> {
  const orgId = organizationId ?? getActiveOrganizationId();
  if (!orgId) {
    throw new Error("Organization context required to save completion settings");
  }
  const { saveOrganizationCompletionSettings } = await import(
    "../../organization/jiraConfigStore"
  );
  return saveOrganizationCompletionSettings(orgId, settings);
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
}): never {
  void input;
  throw new Error(
    "savePipelineIntakeColumn is deprecated — use saveOrganizationPipelineIntake via PUT /pipeline-jira/intake-column"
  );
}
