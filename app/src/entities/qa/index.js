import { DATA_MODE } from "../../shared/config/app";
import { fetchJson } from "../../shared/lib/fetchJson";
import { apiPath } from "../../shared/config/apiBase";
import { useResource } from "../../shared/lib/useResource";
import { mockApi } from "../../app/api/mock";

const restQaAdapter = {
  coverage: () => fetchJson(apiPath("/api/qa/coverage")),
  heatmap: () => fetchJson(apiPath("/api/qa/heatmap")),
  failures: () => fetchJson(apiPath("/api/qa/failures")),
  reports: () => fetchJson(apiPath("/api/qa/pipeline-reports")),
  report: (pipelineId) => fetchJson(apiPath(`/api/qa/pipeline-reports/${pipelineId}`)),
  pipelineReports: () => fetchJson(apiPath("/api/qa/pipeline-reports")),
  pipelineReport: (pipelineId) =>
    fetchJson(apiPath(`/api/qa/pipeline-reports/${pipelineId}`)),
};

const mockQaAdapter = {
  coverage: () => mockApi.qaCoverage(),
  heatmap: () => mockApi.qaHeatmap(),
  failures: () => mockApi.qaFailures(),
  reports: () => mockApi.qaReports(),
  report: (ticketId) => mockApi.qaReport(ticketId),
};

export const qaAdapter = DATA_MODE === "rest" ? restQaAdapter : mockQaAdapter;

export function useQaCoverage(options = {}) {
  return useResource(() => qaAdapter.coverage(), [], { pollMs: options.pollMs });
}

export function useQaHeatmap(options = {}) {
  return useResource(() => qaAdapter.heatmap(), [], { pollMs: options.pollMs });
}

export function useQaFailures(options = {}) {
  return useResource(() => qaAdapter.failures(), [], { pollMs: options.pollMs });
}

export function useQaReports(options = {}) {
  return useResource(() => qaAdapter.reports(), [], { pollMs: options.pollMs });
}

export function useQaPipelineReport(pipelineId, options = {}) {
  return useResource(
    () => (pipelineId ? qaAdapter.pipelineReport(pipelineId) : Promise.resolve(null)),
    [pipelineId],
    { pollMs: options.pollMs }
  );
}
