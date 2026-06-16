import { useMemo } from "react";
import { usePipelineList } from "../../entities/pipeline";
import { useCostsDaily } from "../../entities/costs";
import { useQaReports } from "../../entities/qa";
import {
  derivePipelineCounts,
  deriveRecentCompletions,
  deriveReviewQueueItems,
} from "../../shared/lib/pipelineCounts";
import { formatCostToday, derivePassRate } from "../../shared/lib/dashboardMetrics";
import {
  useActivityEvents,
  useAgentHealth,
  useWeeklyTrend,
} from "../../entities/workspace";
import DashboardStatusBar from "./DashboardStatusBar";
import ReviewQueuePanel from "./ReviewQueuePanel";
import DashboardLiveActivity from "./DashboardLiveActivity";
import WeeklyTrendChart from "./WeeklyTrendChart";
import RecentCompletionsPanel from "./RecentCompletionsPanel";
import AgentHealthPanel from "./AgentHealthPanel";
import DashboardCostEstimator from "./DashboardCostEstimator";

function buildStatusMetrics(counts, costToday = "—", passRate = "—") {
  return [
    {
      id: "running",
      label: "Running",
      value: String(counts.running),
      tone: "running",
      href: "/app/pipelines?tab=active",
    },
    {
      id: "review",
      label: "Need review",
      value: String(counts.review),
      tone: "review",
      href: "/app/pipelines?tab=review",
    },
    {
      id: "completed",
      label: "Completed",
      value: String(counts.completedToday),
      tone: "success",
      href: "/app/pipelines?tab=history",
    },
    {
      id: "cost",
      label: "Cost today",
      value: costToday,
      tone: "neutral",
      href: "/app/costs",
    },
    {
      id: "pass_rate",
      label: "Pass rate",
      value: passRate,
      tone: "success",
      href: "/app/qa",
    },
  ];
}

export default function LandingDashboardWidget() {
  const { items: pipelines, loading: pipelinesLoading } = usePipelineList(undefined, {
    pollMs: 10_000,
  });
  const counts = useMemo(() => derivePipelineCounts(pipelines), [pipelines]);
  const reviewItems = useMemo(() => deriveReviewQueueItems(pipelines), [pipelines]);
  const completions = useMemo(() => deriveRecentCompletions(pipelines), [pipelines]);

  const { data: costsDaily, loading: costsLoading } = useCostsDaily({ pollMs: 30_000 });
  const { data: qaReports, loading: qaLoading } = useQaReports({ pollMs: 30_000 });
  const costToday = useMemo(() => formatCostToday(costsDaily), [costsDaily]);
  const passRate = useMemo(() => derivePassRate(qaReports), [qaReports]);
  const statusMetrics = useMemo(
    () => buildStatusMetrics(counts, costToday, passRate),
    [counts, costToday, passRate]
  );
  const metricsLoading = pipelinesLoading || costsLoading || qaLoading;

  const { data: eventsData, loading: eventsLoading } = useActivityEvents({ pollMs: 30_000 });
  const { data: trendData, loading: trendLoading } = useWeeklyTrend();
  const { data: healthData, loading: healthLoading } = useAgentHealth({ pollMs: 30_000 });

  return (
    <div className="space-y-6">
      <DashboardStatusBar metrics={statusMetrics} loading={metricsLoading} />

      <section className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <ReviewQueuePanel items={reviewItems} loading={pipelinesLoading} />
        <DashboardLiveActivity events={eventsData?.events} loading={eventsLoading} />
      </section>

      <WeeklyTrendChart trend={trendData} loading={trendLoading} />

      <section className="grid gap-6 lg:grid-cols-2">
        <RecentCompletionsPanel items={completions} loading={pipelinesLoading} />
        <AgentHealthPanel agents={healthData?.agents} loading={healthLoading} />
      </section>

      <DashboardCostEstimator />
    </div>
  );
}
