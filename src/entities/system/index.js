import { ReadinessResponseSchema } from "../../contracts";
import { DATA_MODE } from "../../shared/config/app";
import { fetchJson } from "../../shared/lib/fetchJson";
import { useResource } from "../../shared/lib/useResource";
import { mockApi } from "../../app/api/mock";

const BASE = "/api";

const restSystemAdapter = {
  async readiness() {
    return ReadinessResponseSchema.parse(await fetchJson(`${BASE}/readyz`));
  },
};

const mockSystemAdapter = {
  async readiness() {
    return ReadinessResponseSchema.parse(await mockApi.readiness());
  },
};

export const systemAdapter =
  DATA_MODE === "rest" ? restSystemAdapter : mockSystemAdapter;

export function useReadiness(options = {}) {
  return useResource(() => systemAdapter.readiness(), [], {
    pollMs: options.pollMs ?? 15000,
  });
}
