import { estimateAnalysisCost } from "./orchestrator";
import type { PmAnalysisRecord } from "./types";
import { pmAnalysisStore } from "./store";
import {
  isAwaitingAnanta,
  listPmAnalysesForOrg,
  resolveHandoffForRecord,
  type PmAnalysisListFilter,
  type PmAnalysisListItem,
} from "./handoffStatus";

export async function buildPmAnalysisListItems(
  organizationId: string,
  options: { limit?: number; filter?: PmAnalysisListFilter } = {}
): Promise<PmAnalysisListItem[]> {
  const filter = options.filter ?? "all";
  const records = await listPmAnalysesForOrg(organizationId, options);

  const items: PmAnalysisListItem[] = [];
  for (const record of records) {
    let handoff = await resolveHandoffForRecord(record, organizationId);
    const storedStatus = record.engineeringHandoff?.status ?? "not_started";
    if (
      handoff.status !== storedStatus &&
      handoff.status !== "not_started" &&
      handoff.status !== "pending"
    ) {
      pmAnalysisStore.update(record.jiraKey, {
        organizationId,
        engineeringHandoff: handoff,
      });
    }
    const merged = { ...record, engineeringHandoff: handoff };
    const hasPrd = Boolean(record.generatedPrd);
    const awaitingAnanta = isAwaitingAnanta(merged);

    if (filter === "has_prd" && !hasPrd) continue;
    if (filter === "awaiting_ananta" && !awaitingAnanta) continue;

    items.push(toListItem(merged, handoff, awaitingAnanta));
  }

  return items;
}

function toListItem(
  record: PmAnalysisRecord,
  handoff: PmAnalysisListItem["engineeringHandoff"],
  awaitingAnanta: boolean
): PmAnalysisListItem {
  return {
    id: record.id,
    jiraKey: record.jiraKey,
    status: record.status,
    currentStage: record.currentStage,
    summary: record.ticketInput.summary,
    agent: record.agentName ?? "Virin",
    ticketType: record.neelIntake?.ticketType ?? record.classification?.type ?? null,
    recommendation:
      record.prioritization?.recommendation ??
      record.solutioning?.recommendedApproach?.slice(0, 80) ??
      null,
    severity: record.classification?.severity ?? null,
    awaiting: record.status === "AWAITING_INPUT" || record.status === "AWAITING_CONFIRMATION",
    startedAt: record.startedAt,
    completedAt: record.completedAt ?? null,
    costUsd: estimateAnalysisCost(record),
    hasPrd: Boolean(record.generatedPrd),
    prdTitle: record.generatedPrd?.title ?? null,
    prdConfidence: record.generatedPrd?.prdConfidence ?? null,
    engineeringHandoff: handoff,
    awaitingAnanta,
  };
}

export async function buildPrdSummary(
  organizationId: string,
  jiraKey: string
): Promise<{
  jiraKey: string;
  title: string | null;
  problemStatement: string | null;
  userStoryCount: number;
  confidence: number | null;
  completedAt: string | null;
  handoff: PmAnalysisListItem["engineeringHandoff"];
} | null> {
  const records = await listPmAnalysesForOrg(organizationId, { limit: 200 });
  const record = records.find((r) => r.jiraKey === jiraKey.trim().toUpperCase());
  if (!record?.generatedPrd) return null;

  const handoff = await resolveHandoffForRecord(record, organizationId);
  return {
    jiraKey: record.jiraKey,
    title: record.generatedPrd.title ?? null,
    problemStatement: record.generatedPrd.problemStatement ?? null,
    userStoryCount: record.generatedPrd.userStories?.length ?? 0,
    confidence: record.generatedPrd.prdConfidence ?? null,
    completedAt: record.completedAt ?? null,
    handoff,
  };
}
