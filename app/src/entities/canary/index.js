import { DATA_MODE } from "../../shared/config/app";
import { fetchJson } from "../../shared/lib/fetchJson";
import { apiPath } from "../../shared/config/apiBase";
import { useResource } from "../../shared/lib/useResource";
import { mockApi } from "../../app/api/mock";

const restCanaryAdapter = {
  runs: () => fetchJson(apiPath("/api/canary/runs")),
  run: (id) => fetchJson(apiPath(`/api/canary/runs/${id}`)),
  trigger: (body = {}) =>
    fetchJson(apiPath("/api/canary/run"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ async: true, environment: "staging", scope: "full", ...body }),
    }),
  nightlySummary: () => fetchJson(apiPath("/api/canary/nightly-summary")),
};

const mockCanaryAdapter = {
  runs: () => mockApi.canaryRuns(),
  run: (id) => mockApi.canaryRun(id),
  trigger: () => mockApi.canaryTrigger(),
  nightlySummary: () => mockApi.canaryNightlySummary(),
};

export const canaryAdapter = DATA_MODE === "rest" ? restCanaryAdapter : mockCanaryAdapter;

export function useCanaryRuns(options = {}) {
  return useResource(() => canaryAdapter.runs(), [], { pollMs: options.pollMs ?? 15_000 });
}

export function useCanaryRun(id, options = {}) {
  return useResource(
    () => (id ? canaryAdapter.run(id) : Promise.resolve(null)),
    [id],
    { pollMs: options.pollMs }
  );
}

export function useCanaryNightlySummary(options = {}) {
  return useResource(() => canaryAdapter.nightlySummary(), [], { pollMs: options.pollMs });
}

export async function triggerCanaryRun(body) {
  return canaryAdapter.trigger(body);
}
