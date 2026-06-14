import type { PipelineStage } from "../generated/prisma/client";
import { getPrisma } from "../db/client";
import { DEFAULT_ROI_ASSUMPTIONS } from "./assumptions";
import type {
  CostsDailyDay,
  CostsSummary,
  FeatureRoiRow,
} from "./types";

const PRODUCT_STAGES: PipelineStage[] = ["PRODUCT_AGENT", "PRD_VALIDATION"];
const ENGINEERING_STAGES: PipelineStage[] = [
  "ENGINEERING_AGENT",
  "IMPLEMENTATION_VALIDATION",
];
const QA_STAGES: PipelineStage[] = ["QA_AGENT", "QA_VALIDATION"];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function stageBucket(stage: PipelineStage): "product" | "engineering" | "qa" | "other" {
  if (PRODUCT_STAGES.includes(stage)) return "product";
  if (ENGINEERING_STAGES.includes(stage)) return "engineering";
  if (QA_STAGES.includes(stage)) return "qa";
  return "other";
}

function extractComplexityScore(output: unknown): number {
  if (!output || typeof output !== "object") return 5;
  const record = output as Record<string, unknown>;
  const scores = record.scores as Record<string, unknown> | undefined;
  if (typeof scores?.complexityScore === "number") return scores.complexityScore;
  const discovery = record.discovery as Record<string, unknown> | undefined;
  const assessment = discovery?.complexityAssessment as Record<string, unknown> | undefined;
  if (typeof assessment?.overallScore === "number") return assessment.overallScore;
  return 5;
}

function estimateHoursSaved(complexityScore: number): number {
  const baseline = DEFAULT_ROI_ASSUMPTIONS.baselineHoursPerRun;
  const factor =
    DEFAULT_ROI_ASSUMPTIONS.productSavingsPct +
    DEFAULT_ROI_ASSUMPTIONS.engineeringSavingsPct +
    DEFAULT_ROI_ASSUMPTIONS.qaSavingsPct;
  const complexityMultiplier = 0.6 + complexityScore / 20;
  return Math.round(baseline * factor * complexityMultiplier * 10) / 10;
}

function emptySummary(): CostsSummary {
  return { monthSpend: 0, avgPerFeature: 0, costPerToken: 0 };
}

export async function getCostsSummary(): Promise<CostsSummary> {
  const prisma = getPrisma();
  if (!prisma) return emptySummary();

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const logs = await prisma.pipelineStageLog.findMany({
    where: { completedAt: { gte: startOfMonth }, costUsd: { not: null } },
    select: { costUsd: true, tokenCount: true, pipelineId: true },
  });

  if (logs.length === 0) return emptySummary();

  const monthSpend = logs.reduce((sum, row) => sum + (row.costUsd ?? 0), 0);
  const tokens = logs.reduce((sum, row) => sum + (row.tokenCount ?? 0), 0);
  const pipelineIds = new Set(logs.map((row) => row.pipelineId));

  return {
    monthSpend: Math.round(monthSpend * 100) / 100,
    avgPerFeature:
      pipelineIds.size > 0
        ? Math.round((monthSpend / pipelineIds.size) * 100) / 100
        : 0,
    costPerToken:
      tokens > 0 ? Math.round((monthSpend / tokens) * 1_000_000) / 1_000_000 : 0,
  };
}

export async function getCostsDaily(): Promise<{ days: CostsDailyDay[] }> {
  const prisma = getPrisma();
  if (!prisma) return { days: [] };

  const since = new Date();
  since.setDate(since.getDate() - 6);
  since.setHours(0, 0, 0, 0);

  const logs = await prisma.pipelineStageLog.findMany({
    where: { completedAt: { gte: since }, costUsd: { not: null } },
    select: { completedAt: true, costUsd: true, stage: true },
  });

  const buckets = new Map<string, CostsDailyDay>();

  for (let i = 0; i < 7; i += 1) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, {
      day: DAY_LABELS[d.getDay()],
      product: 0,
      engineering: 0,
      qa: 0,
    });
  }

  for (const log of logs) {
    if (!log.completedAt) continue;
    const key = log.completedAt.toISOString().slice(0, 10);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    const cost = log.costUsd ?? 0;
    const group = stageBucket(log.stage);
    if (group === "product") bucket.product += cost;
    else if (group === "engineering") bucket.engineering += cost;
    else if (group === "qa") bucket.qa += cost;
  }

  for (const bucket of buckets.values()) {
    bucket.product = Math.round(bucket.product * 100) / 100;
    bucket.engineering = Math.round(bucket.engineering * 100) / 100;
    bucket.qa = Math.round(bucket.qa * 100) / 100;
  }

  return { days: Array.from(buckets.values()) };
}

export async function getCostsByFeature(hourlyRate = 150): Promise<{
  features: FeatureRoiRow[];
}> {
  const prisma = getPrisma();
  if (!prisma) return { features: [] };

  const pipelines = await prisma.pipeline.findMany({
    take: 50,
    orderBy: { startedAt: "desc" },
    include: {
      ticket: { select: { jiraKey: true, normalizedData: true } },
      stages: {
        where: { costUsd: { not: null } },
        select: { costUsd: true, tokenCount: true, output: true, stage: true },
      },
    },
  });

  const features: FeatureRoiRow[] = [];

  for (const pipeline of pipelines) {
    if (pipeline.stages.length === 0) continue;

    const cost = pipeline.stages.reduce((sum, s) => sum + (s.costUsd ?? 0), 0);
    const tokens = pipeline.stages.reduce((sum, s) => sum + (s.tokenCount ?? 0), 0);
    const productStage = pipeline.stages.find((s) => PRODUCT_STAGES.includes(s.stage));
    const complexity = extractComplexityScore(productStage?.output);
    const hoursSaved = estimateHoursSaved(complexity);
    const laborValue = hoursSaved * hourlyRate;
    const roi = Math.round((laborValue / Math.max(cost, 0.01)) * 10) / 10;

    const normalized = pipeline.ticket.normalizedData as Record<string, unknown> | null;
    const title =
      (typeof normalized?.summary === "string" && normalized.summary) ||
      pipeline.ticket.jiraKey;

    features.push({
      jiraKey: pipeline.ticket.jiraKey,
      title,
      tokens,
      cost: Math.round(cost * 100) / 100,
      hoursSaved,
      roi,
    });
  }

  return { features };
}
