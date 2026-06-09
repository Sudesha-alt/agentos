export const PM_PIPELINE_PREFIX = "pm:";

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
    summary: pm.summary ?? "PM analysis",
    currentStage: pm.currentStage,
    status: pm.status,
    startedAt: pm.startedAt,
    completedAt: pm.completedAt ?? null,
    recommendation: pm.recommendation ?? null,
    severity: pm.severity ?? null,
    costUsd: pm.costUsd ?? null,
    raw: pm,
  };
}
