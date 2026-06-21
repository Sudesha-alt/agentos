import { prisma } from "../../db/client";
import { listPmAnalysisRecordsForOrg } from "../../db/repositories/pmAnalysisRepo";
import { pmAnalysisStore } from "./store";
import type { EngineeringHandoff, EngineeringHandoffStatus, PmAnalysisRecord } from "./types";
import { logger } from "../../utils/logger";

const TRANSFERRED: EngineeringHandoffStatus[] = ["enqueued", "running", "completed"];

export function isHandoffTransferred(status?: EngineeringHandoffStatus): boolean {
  return Boolean(status && TRANSFERRED.includes(status));
}

export function isAwaitingAnanta(record: PmAnalysisRecord): boolean {
  return (
    record.status === "COMPLETED" &&
    Boolean(record.generatedPrd) &&
    !isHandoffTransferred(record.engineeringHandoff?.status)
  );
}

export function patchEngineeringHandoff(
  jiraKey: string,
  patch: Partial<EngineeringHandoff> & { status: EngineeringHandoffStatus }
): void {
  const existing = pmAnalysisStore.get(jiraKey);
  const now = new Date().toISOString();
  pmAnalysisStore.update(jiraKey, {
    engineeringHandoff: {
      status: patch.status,
      pipelineId: patch.pipelineId ?? existing?.engineeringHandoff?.pipelineId,
      attemptedAt: patch.attemptedAt ?? now,
      message: patch.message ?? existing?.engineeringHandoff?.message,
    },
  });
}

function handoffFromPipelineStatus(
  pipeline: { id: string; status: string; currentStage: string },
  message?: string
): EngineeringHandoff {
  const attemptedAt = new Date().toISOString();
  if (pipeline.status === "COMPLETED") {
    return { status: "completed", pipelineId: pipeline.id, attemptedAt, message };
  }
  if (pipeline.status === "FAILED") {
    return {
      status: "failed",
      pipelineId: pipeline.id,
      attemptedAt,
      message: message ?? "Engineering pipeline failed",
    };
  }
  if (pipeline.status === "RUNNING" || pipeline.status === "PAUSED") {
    const pastProduct =
      pipeline.currentStage === "ENGINEERING_AGENT" ||
      pipeline.currentStage === "IMPLEMENTATION_VALIDATION" ||
      pipeline.currentStage === "QA_AGENT" ||
      pipeline.currentStage === "QA_VALIDATION" ||
      pipeline.currentStage === "OUTPUT";
    return {
      status: pastProduct ? "running" : "enqueued",
      pipelineId: pipeline.id,
      attemptedAt,
      message,
    };
  }
  return { status: "enqueued", pipelineId: pipeline.id, attemptedAt, message };
}

export async function inferHandoffFromPipeline(
  jiraKey: string,
  organizationId: string
): Promise<EngineeringHandoff | null> {
  const ticket = await prisma.ticket.findFirst({
    where: { jiraKey: jiraKey.trim().toUpperCase(), organizationId },
  });
  if (!ticket) return null;

  const pipeline = await prisma.pipeline.findFirst({
    where: { ticketId: ticket.id, organizationId },
    orderBy: { startedAt: "desc" },
  });
  if (!pipeline) return null;

  return handoffFromPipelineStatus(pipeline);
}

export async function resolveHandoffForRecord(
  record: PmAnalysisRecord,
  organizationId: string
): Promise<EngineeringHandoff> {
  const stored = record.engineeringHandoff;
  const inferred = await inferHandoffFromPipeline(record.jiraKey, organizationId);

  if (!inferred) {
    return stored ?? { status: "not_started" };
  }

  if (!stored || stored.status === "not_started" || stored.status === "pending" || stored.status === "failed") {
    if (inferred.status !== "not_started") {
      return inferred;
    }
  }

  if (stored && inferred.pipelineId && stored.pipelineId === inferred.pipelineId) {
    const rank: Record<EngineeringHandoffStatus, number> = {
      not_started: 0,
      pending: 1,
      failed: 2,
      enqueued: 3,
      running: 4,
      completed: 5,
    };
    if (rank[inferred.status] >= rank[stored.status]) {
      return { ...stored, ...inferred, message: stored.message ?? inferred.message };
    }
  }

  return stored ?? inferred;
}

export async function resolvePipelineIdForJiraKey(
  jiraKey: string,
  organizationId: string
): Promise<string | null> {
  const ticket = await prisma.ticket.findFirst({
    where: { jiraKey: jiraKey.trim().toUpperCase(), organizationId },
  });
  if (!ticket) return null;
  const pipeline = await prisma.pipeline.findFirst({
    where: { ticketId: ticket.id, organizationId },
    orderBy: { startedAt: "desc" },
  });
  return pipeline?.id ?? null;
}

export async function syncEngineeringHandoffFromPipeline(
  pipelineId: string,
  status: EngineeringHandoffStatus,
  message?: string
): Promise<void> {
  const pipeline = await prisma.pipeline.findUnique({
    where: { id: pipelineId },
    include: { ticket: true },
  });
  if (!pipeline?.ticket) return;

  const jiraKey = pipeline.ticket.jiraKey;
  const record = pmAnalysisStore.get(jiraKey);
  if (!record?.generatedPrd) return;

  patchEngineeringHandoff(jiraKey, {
    status,
    pipelineId,
    message,
  });
}

export async function syncEngineeringHandoffFromPipelineState(
  pipelineId: string
): Promise<void> {
  const pipeline = await prisma.pipeline.findUnique({
    where: { id: pipelineId },
    include: { ticket: true },
  });
  if (!pipeline?.ticket) return;

  const record = pmAnalysisStore.get(pipeline.ticket.jiraKey);
  if (!record?.generatedPrd) return;

  const handoff = handoffFromPipelineStatus(pipeline);
  patchEngineeringHandoff(pipeline.ticket.jiraKey, handoff);
}

export async function backfillEngineeringHandoffRecords(): Promise<number> {
  if (!process.env.DATABASE_URL?.trim()) return 0;

  const rows = await prisma.pmAnalysisRecord.findMany();
  let updated = 0;

  for (const row of rows) {
    const record = row.recordJson as unknown as PmAnalysisRecord;
    if (record.status !== "COMPLETED" || !record.generatedPrd) continue;

    const inferred = await inferHandoffFromPipeline(row.jiraKey, row.organizationId);
    if (!inferred) continue;

    const current = record.engineeringHandoff?.status ?? "not_started";
    const shouldUpdate =
      current === "not_started" ||
      current === "pending" ||
      (inferred.status === "completed" && current !== "completed") ||
      (inferred.status === "running" && (current === "enqueued" || current === "failed"));

    if (!shouldUpdate) continue;

    pmAnalysisStore.update(row.jiraKey, {
      organizationId: row.organizationId,
      engineeringHandoff: inferred,
    });
    updated += 1;
  }

  if (updated > 0) {
    logger.info({ updated }, "backfilled engineering handoff status on PM records");
  }
  return updated;
}

export type PmAnalysisListFilter = "all" | "awaiting_ananta" | "has_prd";

export interface PmAnalysisListItem {
  id: string;
  jiraKey: string;
  status: PmAnalysisRecord["status"];
  currentStage: PmAnalysisRecord["currentStage"];
  summary: string;
  agent: string;
  ticketType: string | null;
  recommendation: string | null;
  severity: string | null;
  awaiting: boolean;
  startedAt: string;
  completedAt: string | null;
  costUsd: number;
  hasPrd: boolean;
  prdTitle: string | null;
  prdConfidence: number | null;
  engineeringHandoff: EngineeringHandoff;
  awaitingAnanta: boolean;
}

export async function listPmAnalysesForOrg(
  organizationId: string,
  options: { limit?: number; filter?: PmAnalysisListFilter } = {}
): Promise<PmAnalysisRecord[]> {
  const limit = options.limit ?? 100;
  const fromDb = await listPmAnalysisRecordsForOrg(organizationId, limit);
  for (const record of fromDb) {
    pmAnalysisStore.hydrate({ ...record, organizationId });
  }
  const cached = pmAnalysisStore.list(limit);
  return cached.filter((r) => !r.organizationId || r.organizationId === organizationId);
}
