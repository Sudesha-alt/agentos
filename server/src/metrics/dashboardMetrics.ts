import type { PipelineStage } from "../generated/prisma/client";
import { getPrisma } from "../db/client";
import { getCostsSummary } from "../roi/actualRoi";

const PRODUCT_STAGES: PipelineStage[] = ["PRODUCT_AGENT", "PRD_VALIDATION"];
const ENGINEERING_STAGES: PipelineStage[] = [
  "ENGINEERING_AGENT",
  "IMPLEMENTATION_VALIDATION",
];
const QA_STAGES: PipelineStage[] = ["QA_AGENT", "QA_VALIDATION"];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type AgentId = "virin" | "ananta" | "neel";

const AGENT_STAGES: Record<AgentId, PipelineStage[]> = {
  virin: PRODUCT_STAGES,
  ananta: ENGINEERING_STAGES,
  neel: QA_STAGES,
};

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDayLabel(date: Date, index: number, total: number): string {
  if (index === total - 1) return "Today";
  return DAY_LABELS[date.getDay()];
}

function avg(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function hoursBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / 3_600_000;
}

export async function getWeeklyTrend(organizationId: string) {
  const prisma = getPrisma();
  if (!prisma) {
    return { points: [], summary: null };
  }

  const since = startOfDay(new Date());
  since.setDate(since.getDate() - 13);

  const [completed, overrides] = await Promise.all([
    prisma.pipeline.findMany({
      where: {
        organizationId,
        status: "COMPLETED",
        completedAt: { gte: since },
      },
      select: { completedAt: true },
    }),
    prisma.humanOverride.findMany({
      where: {
        overriddenAt: { gte: since },
        pipeline: { organizationId },
      },
      select: { overriddenAt: true },
    }),
  ]);

  const completedByDay = new Map<string, number>();
  const interventionsByDay = new Map<string, number>();

  for (let i = 0; i < 14; i += 1) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = dayKey(d);
    completedByDay.set(key, 0);
    interventionsByDay.set(key, 0);
  }

  for (const pipeline of completed) {
    if (!pipeline.completedAt) continue;
    const key = dayKey(pipeline.completedAt);
    if (completedByDay.has(key)) {
      completedByDay.set(key, (completedByDay.get(key) ?? 0) + 1);
    }
  }

  for (const override of overrides) {
    const key = dayKey(override.overriddenAt);
    if (interventionsByDay.has(key)) {
      interventionsByDay.set(key, (interventionsByDay.get(key) ?? 0) + 1);
    }
  }

  const points = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = dayKey(d);
    return {
      label: formatDayLabel(d, i, 14),
      featuresCompleted: completedByDay.get(key) ?? 0,
      humanInterventions: interventionsByDay.get(key) ?? 0,
    };
  });

  const startOfMonth = startOfDay(new Date());
  startOfMonth.setDate(1);

  const monthCompleted = await prisma.pipeline.count({
    where: {
      organizationId,
      status: "COMPLETED",
      completedAt: { gte: startOfMonth },
    },
  });

  const monthPipelines = await prisma.pipeline.findMany({
    where: {
      organizationId,
      status: "COMPLETED",
      completedAt: { gte: startOfMonth },
    },
    select: { startedAt: true, completedAt: true },
  });

  const cycleHours = monthPipelines
    .filter((p) => p.completedAt)
    .map((p) => hoursBetween(p.startedAt, p.completedAt!));

  const costSummary = await getCostsSummary(organizationId);

  return {
    points,
    summary: {
      featuresCompleted: monthCompleted,
      avgCycleHours: cycleHours.length
        ? (Math.round(avg(cycleHours) * 10) / 10).toFixed(1)
        : "—",
      avgCostPerFeature: costSummary.avgPerFeature
        ? costSummary.avgPerFeature.toFixed(2)
        : "—",
    },
  };
}

export async function getCycleTrend(organizationId: string) {
  const prisma = getPrisma();
  if (!prisma) return { points: [] };

  const since = startOfDay(new Date());
  since.setDate(since.getDate() - 29);

  const pipelines = await prisma.pipeline.findMany({
    where: {
      organizationId,
      status: "COMPLETED",
      completedAt: { gte: since },
    },
    select: { startedAt: true, completedAt: true },
  });

  const hoursByDay = new Map<string, number[]>();
  for (let i = 0; i < 30; i += 1) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    hoursByDay.set(dayKey(d), []);
  }

  for (const pipeline of pipelines) {
    if (!pipeline.completedAt) continue;
    const key = dayKey(pipeline.completedAt);
    const bucket = hoursByDay.get(key);
    if (!bucket) continue;
    bucket.push(hoursBetween(pipeline.startedAt, pipeline.completedAt));
  }

  const points = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = dayKey(d);
    const values = hoursByDay.get(key) ?? [];
    return {
      day: formatDayLabel(d, i, 30),
      hours: values.length ? Math.round(avg(values) * 10) / 10 : 0,
    };
  });

  return { points };
}

export async function getAgentHealth(organizationId: string) {
  const prisma = getPrisma();
  if (!prisma) return { agents: [] };

  const sinceToday = startOfDay(new Date());
  const recentSince = new Date(Date.now() - 30 * 24 * 3_600_000);

  const stageLogs = await prisma.pipelineStageLog.findMany({
    where: {
      status: "COMPLETED",
      completedAt: { gte: recentSince },
      pipeline: { organizationId },
      stage: {
        in: [
          ...PRODUCT_STAGES,
          ...ENGINEERING_STAGES,
          ...QA_STAGES,
        ],
      },
    },
    select: {
      stage: true,
      confidenceScore: true,
      completedAt: true,
      output: true,
    },
    orderBy: { completedAt: "desc" },
  });

  const agents: Array<{
    id: AgentId;
    name: string;
    primaryMetric: string;
    primaryValue: string;
    secondaryMetric: string;
    lastRunAt: string | null;
    status: string;
  }> = [];

  for (const [id, stages] of Object.entries(AGENT_STAGES) as Array<
    [AgentId, PipelineStage[]]
  >) {
    const logs = stageLogs.filter((log) => stages.includes(log.stage));
    const todayLogs = logs.filter(
      (log) => log.completedAt && log.completedAt >= sinceToday
    );
    const confidenceValues = logs
      .map((log) => log.confidenceScore)
      .filter((value): value is number => typeof value === "number");

    let primaryMetric = "Avg confidence";
    let primaryValue = "—";

    if (id === "neel") {
      primaryMetric = "Pass rate";
      const passRates = logs
        .map((log) => extractQaPassRate(log.output))
        .filter((value): value is number => value != null);
      primaryValue = passRates.length
        ? `${Math.round(avg(passRates))}%`
        : confidenceValues.length
          ? `${Math.round(avg(confidenceValues) * 100)}%`
          : "—";
    } else if (confidenceValues.length) {
      primaryValue = `${Math.round(avg(confidenceValues) * 100)}%`;
    }

    const secondaryMetric =
      id === "virin"
        ? `${todayLogs.length} PRD${todayLogs.length === 1 ? "" : "s"} today`
        : id === "ananta"
          ? `${todayLogs.length} run${todayLogs.length === 1 ? "" : "s"} today`
          : `${todayLogs.length} test run${todayLogs.length === 1 ? "" : "s"} today`;

    const lastRunAt = logs[0]?.completedAt?.toISOString() ?? null;
    const status =
      lastRunAt && Date.now() - Date.parse(lastRunAt) < 7 * 24 * 3_600_000
        ? "Healthy"
        : "Idle";

    agents.push({
      id,
      name: id,
      primaryMetric,
      primaryValue,
      secondaryMetric,
      lastRunAt,
      status,
    });
  }

  return { agents };
}

function extractQaPassRate(output: unknown): number | null {
  if (!output || typeof output !== "object") return null;
  const record = output as Record<string, unknown>;
  const executionReport = record.executionReport as Record<string, unknown> | undefined;
  const testRun = executionReport?.testRun as Record<string, unknown> | undefined;
  const total = testRun?.totalTests;
  const passed = testRun?.passed;
  if (typeof total === "number" && total > 0 && typeof passed === "number") {
    return Math.round((passed / total) * 100);
  }
  return null;
}

export async function getMetricsSummary(organizationId: string) {
  const prisma = getPrisma();
  if (!prisma) return { metrics: [] };

  const now = new Date();
  const startOfToday = startOfDay(now);
  const startOfWeek = startOfDay(now);
  startOfWeek.setDate(startOfWeek.getDate() - 6);
  const startOfYesterday = startOfDay(now);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const endOfYesterday = startOfDay(now);

  const [
    inPipelineToday,
    inPipelineYesterday,
    completedWeek,
    completedPrevWeek,
    pausedCount,
    costSummary,
  ] = await Promise.all([
    prisma.pipeline.count({
      where: {
        organizationId,
        startedAt: { gte: startOfToday },
        status: { in: ["RUNNING", "PAUSED", "COMPLETED"] },
      },
    }),
    prisma.pipeline.count({
      where: {
        organizationId,
        startedAt: { gte: startOfYesterday, lt: endOfYesterday },
        status: { in: ["RUNNING", "PAUSED", "COMPLETED"] },
      },
    }),
    prisma.pipeline.count({
      where: {
        organizationId,
        status: "COMPLETED",
        completedAt: { gte: startOfWeek },
      },
    }),
    prisma.pipeline.count({
      where: {
        organizationId,
        status: "COMPLETED",
        completedAt: {
          gte: new Date(startOfWeek.getTime() - 7 * 24 * 3_600_000),
          lt: startOfWeek,
        },
      },
    }),
    prisma.pipeline.count({
      where: { organizationId, status: "PAUSED" },
    }),
    getCostsSummary(organizationId),
  ]);

  const weekDelta = completedWeek - completedPrevWeek;
  const todayDelta = inPipelineToday - inPipelineYesterday;

  return {
    metrics: [
      {
        id: "in_pipeline",
        label: "In pipeline today",
        value: String(inPipelineToday),
        delta: `${todayDelta >= 0 ? "+" : ""}${todayDelta} vs yesterday`,
        deltaPositive: todayDelta >= 0,
      },
      {
        id: "completed_week",
        label: "Completed this week",
        value: String(completedWeek),
        delta: `${weekDelta >= 0 ? "+" : ""}${weekDelta} vs last week`,
        deltaPositive: weekDelta >= 0,
      },
      {
        id: "cycle_reduction",
        label: "Cycle time reduction",
        value: completedWeek > 0 ? "Active" : "—",
        delta: "vs manual baseline",
        deltaPositive: true,
      },
      {
        id: "cost_today",
        label: "Cost today",
        value: costSummary.monthSpend
          ? `$${costSummary.monthSpend.toFixed(2)}`
          : "—",
        delta: "month to date",
        deltaPositive: true,
      },
      {
        id: "interventions",
        label: "Human interventions",
        value: String(pausedCount),
        delta: pausedCount === 1 ? "awaiting review" : "awaiting review",
        deltaPositive: pausedCount === 0,
      },
    ],
  };
}

export function buildDashboardStatusMetrics(counts: {
  running?: number;
  review?: number;
  completedToday?: number;
  costToday?: string;
  passRate?: string;
}) {
  return {
    metrics: [
      {
        id: "running",
        label: "Running",
        value: String(counts.running ?? 0),
        tone: "running",
      },
      {
        id: "review",
        label: "Need review",
        value: String(counts.review ?? 0),
        tone: "review",
      },
      {
        id: "completed",
        label: "Completed",
        value: String(counts.completedToday ?? 0),
        tone: "success",
      },
      {
        id: "cost",
        label: "Cost today",
        value: counts.costToday ?? "—",
        tone: "neutral",
      },
      {
        id: "pass_rate",
        label: "Pass rate",
        value: counts.passRate ?? "—",
        tone: "success",
      },
    ],
  };
}
