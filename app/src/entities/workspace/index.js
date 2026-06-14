import { useMemo } from "react";
import { DATA_MODE } from "../../shared/config/app";
import { fetchJson } from "../../shared/lib/fetchJson";
import { apiPath } from "../../shared/config/apiBase";
import { useResource } from "../../shared/lib/useResource";
import { mockApi } from "../../app/api/mock";

const restWorkspaceAdapter = {
  metricsSummary: () => fetchJson(apiPath("/api/metrics/summary")),
  activityEvents: () => fetchJson(apiPath("/api/events/recent")),
  cycleTrend: () => fetchJson(apiPath("/api/metrics/cycle-trend")),
  weeklyTrend: () => fetchJson(apiPath("/api/metrics/weekly-trend")),
  agentHealth: () => fetchJson(apiPath("/api/metrics/agent-health")),
  dashboardStatus: (counts) =>
    fetchJson(apiPath("/api/metrics/dashboard-status"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(counts),
    }),
};

const mockWorkspaceAdapter = {
  metricsSummary: () => mockApi.metricsSummary(),
  activityEvents: () => mockApi.activityEvents(),
  cycleTrend: () => mockApi.cycleTrend(),
  weeklyTrend: () => mockApi.weeklyTrend(),
  agentHealth: () => mockApi.agentHealth(),
  dashboardStatus: (counts) => mockApi.dashboardStatus(counts),
};

export const workspaceAdapter =
  DATA_MODE === "rest" ? restWorkspaceAdapter : mockWorkspaceAdapter;

export function useMetricsSummary(options = {}) {
  return useResource(() => workspaceAdapter.metricsSummary(), [], {
    pollMs: options.pollMs ?? 8000,
  });
}

export function useActivityEvents(options = {}) {
  return useResource(() => workspaceAdapter.activityEvents(), [], {
    pollMs: options.pollMs ?? 6000,
  });
}

export function useCycleTrend(options = {}) {
  return useResource(() => workspaceAdapter.cycleTrend(), [], {
    pollMs: options.pollMs ?? 60_000,
  });
}

export function useWeeklyTrend(options = {}) {
  return useResource(() => workspaceAdapter.weeklyTrend(), [], {
    pollMs: options.pollMs ?? 60_000,
  });
}

export function useAgentHealth(options = {}) {
  return useResource(() => workspaceAdapter.agentHealth(), [], {
    pollMs: options.pollMs ?? 30_000,
  });
}

export function useDashboardStatusMetrics(counts, options = {}) {
  const key = useMemo(() => JSON.stringify(counts ?? {}), [counts]);
  return useResource(() => workspaceAdapter.dashboardStatus(counts), [key], {
    pollMs: options.pollMs ?? 10_000,
  });
}
