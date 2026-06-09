import { DATA_MODE } from "../../shared/config/app";
import { apiPath } from "../../shared/config/apiBase";
import { fetchJson } from "../../shared/lib/fetchJson";
import { useResource } from "../../shared/lib/useResource";
import { mockApi } from "../../app/api/mock";

const pm = (path) => apiPath("/api", `/pm-agents${path}`);

const restPmAdapter = {
  listAnalyses: () => fetchJson(pm("/analyses")),
  getAnalysis: (ticketId) => fetchJson(pm(`/analysis/${encodeURIComponent(ticketId)}`)),
  analyze: (ticketId, body = {}) =>
    fetchJson(pm(`/analyze/${encodeURIComponent(ticketId)}`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  resume: (ticketId, body = {}) =>
    fetchJson(pm(`/analyze/${encodeURIComponent(ticketId)}/resume`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  retrospective: (ticketId, body = {}) =>
    fetchJson(pm(`/retrospective/${encodeURIComponent(ticketId)}`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  getHandoff: (ticketId) =>
    fetchJson(pm(`/handoff/${encodeURIComponent(ticketId)}`)),
  runHandoff: (ticketId) =>
    fetchJson(pm(`/handoff/${encodeURIComponent(ticketId)}`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }),
  startPipeline: (ticketId) =>
    fetchJson(pm(`/handoff/${encodeURIComponent(ticketId)}/start-pipeline`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }),
};

const mockPmAdapter = {
  listAnalyses: () => mockApi.listPmAnalyses(),
  getAnalysis: (ticketId) => mockApi.getPmAnalysis(ticketId),
  analyze: (ticketId, body) => mockApi.analyzePmTicket(ticketId, body),
  resume: (ticketId) => mockApi.resumePmTicket(ticketId),
  retrospective: (ticketId, body) => mockApi.runPmRetrospective(ticketId, body),
  getHandoff: (ticketId) => mockApi.getPmHandoff(ticketId),
  runHandoff: (ticketId) => mockApi.runPmHandoff(ticketId),
  startPipeline: (ticketId) => mockApi.startPmPipeline(ticketId),
};

const adapter = DATA_MODE === "rest" ? restPmAdapter : mockPmAdapter;

export const PM_STAGE_LABELS = {
  ENRICHMENT: "Ticket enrichment",
  CLASSIFICATION: "Classification & severity",
  CODEBASE_IMPACT: "Codebase impact",
  EFFORT: "Effort estimation",
  IMPLEMENTATION: "Implementation suggestion",
  PRIORITIZATION: "Prioritization",
  ACCEPTANCE_CRITERIA: "Acceptance criteria",
  ARTIFACTS: "Communication artifacts",
  RETROSPECTIVE: "Retrospective",
};

export const PM_STAGE_ORDER = [
  "ENRICHMENT",
  "CLASSIFICATION",
  "CODEBASE_IMPACT",
  "EFFORT",
  "IMPLEMENTATION",
  "PRIORITIZATION",
  "ACCEPTANCE_CRITERIA",
  "ARTIFACTS",
];

export function listPmAnalyses() {
  return adapter.listAnalyses();
}

export function getPmAnalysis(ticketId) {
  return adapter.getAnalysis(ticketId);
}

export function analyzePmTicket(ticketId, body) {
  return adapter.analyze(ticketId, body);
}

export function resumePmAnalysis(ticketId, body) {
  return adapter.resume(ticketId, body);
}

export function getPmResumeStage(analysis) {
  if (!analysis) return null;
  if (analysis.currentStage && PM_STAGE_ORDER.includes(analysis.currentStage)) {
    return analysis.currentStage;
  }
  const failed = [...(analysis.stageMeta ?? [])]
    .reverse()
    .find((meta) => meta.status === "FAILED");
  return failed?.stage ?? null;
}

export function runPmRetrospective(ticketId, body) {
  return adapter.retrospective(ticketId, body);
}

export function getPmHandoff(ticketId) {
  return adapter.getHandoff(ticketId);
}

export function runPmHandoff(ticketId) {
  return adapter.runHandoff(ticketId);
}

export function startPmCodingPipeline(ticketId) {
  return adapter.startPipeline(ticketId);
}

export function usePmAnalyses(options = {}) {
  return useResource(() => listPmAnalyses(), [], {
    pollMs: options.pollMs ?? 8000,
  });
}

export function usePmAnalysis(ticketId, options = {}) {
  return useResource(
    () => (ticketId ? getPmAnalysis(ticketId) : Promise.resolve(null)),
    [ticketId],
    {
      pollMs: ticketId ? (options.pollMs ?? 0) : undefined,
    }
  );
}
