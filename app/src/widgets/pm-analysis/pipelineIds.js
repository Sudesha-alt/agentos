import { VIRIN_NAME } from "../../entities/pm-agents";

export const PM_PIPELINE_PREFIX = "pm:";

/** Map Virin statuses to pipeline explorer tab filters. */
export function mapExplorerStatus(pmStatus) {
  switch (pmStatus) {
    case "AWAITING_INPUT":
    case "AWAITING_CONFIRMATION":
      return "PAUSED";
    case "RUNNING":
      return "RUNNING";
    case "COMPLETED":
      return "COMPLETED";
    case "FAILED":
      return "FAILED";
    default:
      return pmStatus;
  }
}

export function isPmPipelineId(id) {
  return typeof id === "string" && id.startsWith(PM_PIPELINE_PREFIX);
}

export function pmPipelineId(jiraKey) {
  return `${PM_PIPELINE_PREFIX}${jiraKey}`;
}

export function jiraKeyFromPmPipelineId(id) {
  return id.slice(PM_PIPELINE_PREFIX.length);
}

export function mapPmAnalysisToPipelineSummary(pm) {
  return {
    id: pmPipelineId(pm.jiraKey),
    kind: "pm",
    ticketId: pm.jiraKey,
    jiraKey: pm.jiraKey,
    summary: pm.summary ?? `${VIRIN_NAME} analysis`,
    currentStage: pm.currentStage,
    status: mapExplorerStatus(pm.status),
    virinStatus: pm.status,
    startedAt: pm.startedAt,
    completedAt: pm.completedAt ?? null,
    recommendation: pm.recommendation ?? null,
    severity: pm.severity ?? null,
    costUsd: pm.costUsd ?? null,
    raw: pm,
  };
}

/** Stages where the classic pipeline should win over a Virin PM card. */
const CLASSIC_PIPELINE_LATE_STAGES = new Set([
  "ENGINEERING_AGENT",
  "IMPLEMENTATION_VALIDATION",
  "QA_AGENT",
  "QA_VALIDATION",
  "OUTPUT",
]);

function explorerStatusRank(status) {
  switch (status) {
    case "RUNNING":
      return 100;
    case "PAUSED":
    case "AWAITING_HUMAN":
      return 90;
    case "QUEUED":
      return 80;
    case "FAILED":
      return 50;
    case "COMPLETED":
      return 10;
    default:
      return 0;
  }
}

function shouldPreferExplorerItem(candidate, existing) {
  if (!existing) return true;
  if (candidate.kind === "queued") return false;

  const candidateLateClassic =
    candidate.kind === "pipeline" &&
    CLASSIC_PIPELINE_LATE_STAGES.has(candidate.currentStage) &&
    ["RUNNING", "PAUSED", "AWAITING_HUMAN", "FAILED"].includes(candidate.status);
  const existingLateClassic =
    existing.kind === "pipeline" &&
    CLASSIC_PIPELINE_LATE_STAGES.has(existing.currentStage) &&
    ["RUNNING", "PAUSED", "AWAITING_HUMAN", "FAILED"].includes(existing.status);

  if (candidateLateClassic && !existingLateClassic) return true;
  if (existingLateClassic && !candidateLateClassic) return false;

  return explorerStatusRank(candidate.status) > explorerStatusRank(existing.status);
}

/** One card per jiraKey — prefer the most relevant pipeline record for the current stage. */
export function mergePipelineExplorerItems(pmSummaries, classicItems, queuedItems) {
  const byKey = new Map();

  for (const item of classicItems) {
    if (item.jiraKey) byKey.set(item.jiraKey, item);
  }

  for (const item of queuedItems) {
    if (item.jiraKey && !byKey.has(item.jiraKey)) {
      byKey.set(item.jiraKey, item);
    }
  }

  for (const item of pmSummaries) {
    const existing = byKey.get(item.jiraKey);
    if (shouldPreferExplorerItem(item, existing)) {
      byKey.set(item.jiraKey, item);
    }
  }

  return [...byKey.values()].sort((a, b) =>
    (b.startedAt ?? "").localeCompare(a.startedAt ?? "")
  );
}

export function resolveQueuedSelection(selectedId, items) {
  if (!selectedId?.startsWith("queued-")) return selectedId ?? null;
  const jiraKey = selectedId.slice("queued-".length);
  const match = items.find((p) => p.jiraKey === jiraKey && p.kind !== "queued");
  return match?.id ?? selectedId;
}
