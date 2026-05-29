import { DATA_MODE } from "../../shared/config/app";
import { fetchJson } from "../../shared/lib/fetchJson";
import { apiPath } from "../../shared/config/apiBase";
import { useResource } from "../../shared/lib/useResource";
import { mockApi } from "../../app/api/mock";

const restWorkspaceAdapter = {
  metricsSummary: () => fetchJson(apiPath("/api/metrics/summary")),
  activityEvents: () => fetchJson(apiPath("/api/events/recent")),
  cycleTrend: () => fetchJson(apiPath("/api/metrics/cycle-trend")),
};

const mockWorkspaceAdapter = {
  metricsSummary: () => mockApi.metricsSummary(),
  activityEvents: () => mockApi.activityEvents(),
  cycleTrend: () => mockApi.cycleTrend(),
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
