import { fetchJson } from "../../shared/lib/fetchJson";
import { useResource } from "../../shared/lib/useResource";

/** Proxied to agentos server (:4000) via vite.config.js /jira-intake */
const BASE = "/jira-intake";

export async function listAiWorkerIssues(active = "1") {
  return fetchJson(`${BASE}/ai-worker/issues?active=${active}`);
}

export async function getAiWorkerDebug() {
  return fetchJson(`${BASE}/ai-worker/debug/last-webhook`);
}

export async function getAiWorkerConfig() {
  return fetchJson(`${BASE}/ai-worker/config`);
}

export async function searchBoard(keyword, searchIn = "both") {
  const params = new URLSearchParams({
    keyword,
    searchIn,
  });
  return fetchJson(`${BASE}/boards/search?${params}`);
}

export async function getIntakeHealth() {
  return fetchJson(`${BASE}/health`);
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
