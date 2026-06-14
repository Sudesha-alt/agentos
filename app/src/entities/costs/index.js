import { DATA_MODE } from "../../shared/config/app";
import { fetchJson } from "../../shared/lib/fetchJson";
import { apiPath } from "../../shared/config/apiBase";
import { useResource } from "../../shared/lib/useResource";
import { mockApi } from "../../app/api/mock";
import { computeEstimatedRoi } from "../../shared/roi/estimatedRoi";

function buildRoiQuery(params) {
  const qs = new URLSearchParams({
    planId: params.planId ?? "growth",
    teamSize: String(params.teamSize ?? 10),
    hourlyRate: String(params.hourlyRate ?? 150),
    pipelineRunsPerMonth: String(params.pipelineRunsPerMonth ?? 80),
    sprintWeeks: String(params.sprintWeeks ?? 2),
    reworkRate: String(params.reworkRate ?? 0.25),
  });
  return qs.toString();
}

const restCostsAdapter = {
  summary: () => fetchJson(apiPath("/api/costs/summary")),
  daily: () => fetchJson(apiPath("/api/costs/daily")),
  byFeature: (hourlyRate) =>
    fetchJson(apiPath(`/api/costs/by-feature?hourlyRate=${hourlyRate ?? 150}`)),
  roi: (params) => fetchJson(apiPath(`/api/costs/roi?${buildRoiQuery(params)}`)),
};

const mockCostsAdapter = {
  summary: () => mockApi.costsSummary(),
  daily: () => mockApi.costsDaily(),
  byFeature: (hourlyRate) => mockApi.costsByFeature({ hourlyRate }),
  roi: (params) => mockApi.costsRoi(params),
};

export const costsAdapter = DATA_MODE === "rest" ? restCostsAdapter : mockCostsAdapter;

/** Normalize API / mock / client shapes for legacy UI fields */
export function normalizeRoiResult(result) {
  if (!result) return null;
  const roi = result.roi ?? result;
  return {
    ...roi,
    annualSavings: roi.annualLaborSavings,
    netBenefit: roi.netAnnualBenefit,
    subscriptionCost: roi.assumptions?.monthlyPrice ?? roi.annualSubscription / 12,
  };
}

export function computeRoiClient(params) {
  return normalizeRoiResult(computeEstimatedRoi(params));
}

export function useCostsSummary(options = {}) {
  return useResource(() => costsAdapter.summary(), [], { pollMs: options.pollMs });
}

export function useCostsDaily(options = {}) {
  return useResource(() => costsAdapter.daily(), [], { pollMs: options.pollMs });
}

export function useCostsByFeature(hourlyRate, options = {}) {
  return useResource(
    () => costsAdapter.byFeature(hourlyRate),
    [hourlyRate],
    { pollMs: options.pollMs }
  );
}

export function useCostsRoi(params, options = {}) {
  return useResource(
    () => costsAdapter.roi(params).then(normalizeRoiResult),
    [
      params.planId,
      params.teamSize,
      params.hourlyRate,
      params.pipelineRunsPerMonth,
      params.sprintWeeks,
      params.reworkRate,
    ],
    { pollMs: options.pollMs }
  );
}
