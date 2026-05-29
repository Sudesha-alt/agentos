import { DATA_MODE } from "../../shared/config/app";
import { fetchJson } from "../../shared/lib/fetchJson";
import { apiPath } from "../../shared/config/apiBase";
import { useResource } from "../../shared/lib/useResource";
import { mockApi } from "../../app/api/mock";

const restCostsAdapter = {
  summary: () => fetchJson(apiPath("/api/costs/summary")),
  daily: () => fetchJson(apiPath("/api/costs/daily")),
  byFeature: () => fetchJson(apiPath("/api/costs/by-feature")),
  roi: (params) =>
    fetchJson(
      apiPath(
        `/api/costs/roi?hourlyRate=${params.hourlyRate}&sprintWeeks=${params.sprintWeeks}&reworkRate=${params.reworkRate}`
      )
    ),
};

const mockCostsAdapter = {
  summary: () => mockApi.costsSummary(),
  daily: () => mockApi.costsDaily(),
  byFeature: () => mockApi.costsByFeature(),
  roi: (params) => mockApi.costsRoi(params),
};

export const costsAdapter = DATA_MODE === "rest" ? restCostsAdapter : mockCostsAdapter;

export function useCostsSummary(options = {}) {
  return useResource(() => costsAdapter.summary(), [], { pollMs: options.pollMs });
}

export function useCostsDaily(options = {}) {
  return useResource(() => costsAdapter.daily(), [], { pollMs: options.pollMs });
}

export function useCostsByFeature(options = {}) {
  return useResource(() => costsAdapter.byFeature(), [], { pollMs: options.pollMs });
}

export function useCostsRoi(params, options = {}) {
  return useResource(
    () => costsAdapter.roi(params),
    [params.hourlyRate, params.sprintWeeks, params.reworkRate],
    { pollMs: options.pollMs }
  );
}
