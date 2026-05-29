import { apiPath } from "../../shared/config/apiBase";
import { fetchJson } from "../../shared/lib/fetchJson";
import { useResource } from "../../shared/lib/useResource";

const intake = (path) => apiPath("/jira-intake", path);

export async function listAiWorkerIssues(active = "1") {
  return fetchJson(intake(`/ai-worker/issues?active=${active}`));
}

export async function getAiWorkerDebug() {
  return fetchJson(intake("/ai-worker/debug/last-webhook"));
}

export async function getAiWorkerConfig() {
  return fetchJson(intake("/ai-worker/config"));
}

export async function searchBoard(keyword, searchIn = "both") {
  const params = new URLSearchParams({
    keyword,
    searchIn,
  });
  return fetchJson(intake(`/boards/search?${params}`));
}

export async function getIntakeHealth() {
  return fetchJson(intake("/health"));
}

/** Dashboard + status line: active count, last webhook, intake health. */
export async function fetchJiraIntakeSummary() {
  const [debug, health] = await Promise.all([
    getAiWorkerDebug(),
    getIntakeHealth().catch(() => ({ ok: false })),
  ]);
  return {
    stats: debug.stats,
    last: debug.last,
    intakeOk: health?.ok === true,
  };
}

export function useJiraIntakeSummary(options = {}) {
  return useResource(() => fetchJiraIntakeSummary(), [], {
    pollMs: options.pollMs ?? 12000,
  });
}

export async function getIntegrationSetup() {
  return fetchJson(intake("/integration/setup"));
}

export async function connectJiraIntegration(body) {
  return fetchJson(intake("/integration/connect"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function registerJiraWebhook(body = {}) {
  return fetchJson(intake("/integration/webhook/register"), {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getJiraWebhookStatus() {
  return fetchJson(intake("/integration/webhook/status"));
}

export async function getBoardColumns() {
  return fetchJson(intake("/boards/columns"));
}

export async function getIntegrationMapping() {
  return fetchJson(intake("/integration/mapping"));
}

export async function saveIntegrationMapping(body) {
  return fetchJson(intake("/integration/mapping"), {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function syncWorkingColumn() {
  return fetchJson(intake("/ai-worker/sync"), { method: "POST" });
}

export async function advanceIssue(issueKey) {
  return fetchJson(
    intake(`/ai-worker/issues/${encodeURIComponent(issueKey)}/advance`),
    { method: "POST" }
  );
}

export function useIntegrationSetup(options = {}) {
  return useResource(() => getIntegrationSetup(), [], {
    pollMs: options.pollMs ?? 30000,
  });
}
