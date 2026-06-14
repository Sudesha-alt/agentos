import { DATA_MODE } from "../../shared/config/app";
import { apiPath } from "../../shared/config/apiBase";
import { fetchJson } from "../../shared/lib/fetchJson";
import { useResource } from "../../shared/lib/useResource";
import { mockApi } from "../../app/api/mock";

export const VIRIN_NAME = "Virin";

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
  answer: (ticketId, answer) =>
    fetchJson(pm(`/analyze/${encodeURIComponent(ticketId)}/answer`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer }),
    }),
  confirm: (ticketId, body) =>
    fetchJson(pm(`/analyze/${encodeURIComponent(ticketId)}/confirm`), {
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
  postShip: (ticketId, body = {}) =>
    fetchJson(pm(`/post-ship/${encodeURIComponent(ticketId)}`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  exportPackage: (ticketId) =>
    fetchJson(pm(`/analysis/${encodeURIComponent(ticketId)}/export`)),
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
  answer: () => Promise.resolve({ status: "RUNNING" }),
  confirm: () => Promise.resolve({ status: "RUNNING" }),
  resume: (ticketId) => mockApi.resumePmTicket(ticketId),
  retrospective: (ticketId, body) => mockApi.runPmRetrospective(ticketId, body),
  postShip: () => Promise.resolve({ postShip: null }),
  exportPackage: (ticketId) => mockApi.getPmAnalysis(ticketId),
  getHandoff: (ticketId) => mockApi.getPmHandoff(ticketId),
  runHandoff: (ticketId) => mockApi.runPmHandoff(ticketId),
  startPipeline: (ticketId) => mockApi.startPmPipeline(ticketId),
};

const adapter = DATA_MODE === "rest" ? restPmAdapter : mockPmAdapter;

export const PM_STAGE_LABELS = {
  INTAKE: "Intake & classification",
  QUESTION_MODE: "Discovery conversation",
  COMPETITOR_ANALYSIS: "Competitor analysis",
  CODEBASE_ANALYSIS: "Codebase analysis",
  SYSTEM_DESIGN: "System design",
  TASK_PLANNING: "Task plan",
  SOLUTIONING: "Solution direction",
  PRD: "PRD generation",
  HANDOFF: "Engineering handoff",
  POST_SHIP: "Post-ship review",
  RETROSPECTIVE: "Retrospective",
};

export const PM_STAGE_ORDER = [
  "INTAKE",
  "QUESTION_MODE",
  "COMPETITOR_ANALYSIS",
  "CODEBASE_ANALYSIS",
  "SYSTEM_DESIGN",
  "TASK_PLANNING",
  "SOLUTIONING",
  "PRD",
  "HANDOFF",
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

export function answerVirinQuestion(ticketId, answer) {
  return adapter.answer(ticketId, answer);
}

export function confirmVirinDirection(ticketId, body) {
  return adapter.confirm(ticketId, body);
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

export function runVirinPostShip(ticketId, body) {
  return adapter.postShip(ticketId, body);
}

export function exportProductPackage(ticketId) {
  return adapter.exportPackage(ticketId);
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
  const poll =
    options.pollMs ??
    (ticketId ? 2500 : 0);
  return useResource(
    () => (ticketId ? getPmAnalysis(ticketId) : Promise.resolve(null)),
    [ticketId],
    {
      pollMs: ticketId ? poll : undefined,
    }
  );
}
