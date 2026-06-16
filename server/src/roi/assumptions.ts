import type { PlanId, RoiAssumptionsSnapshot } from "./types";

/** v1 — keep in sync with app/src/shared/roi/assumptions.js */
export const ROI_ASSUMPTIONS_VERSION = "1.0.0";

/** Human labor baseline saved per agent pipeline run (ROI comparison) — NOT agent runtime. */
export const DEFAULT_ROI_ASSUMPTIONS: RoiAssumptionsSnapshot = {
  version: ROI_ASSUMPTIONS_VERSION,
  baselineHoursPerRun: 32,
  productSavingsPct: 0.25,
  engineeringSavingsPct: 0.35,
  qaSavingsPct: 0.2,
  reworkMultiplier: 0.4,
  defaultSprintWeeks: 2,
};

/** Typical end-to-end agent pipeline wall-clock time for display/reference only. */
export const TYPICAL_AGENT_PIPELINE_HOURS = 4;

export interface PlanPricing {
  monthlyPrice: number;
  runsCap: number | null;
  overagePerRun: number;
}

/** Tier economics — mirror app/src/shared/config/billingPlans.js PLAN_PRICING */
export const PLAN_PRICING: Record<PlanId, PlanPricing> = {
  starter: { monthlyPrice: 1999, runsCap: 40, overagePerRun: 40 },
  growth: { monthlyPrice: 4999, runsCap: 150, overagePerRun: 35 },
  enterprise: { monthlyPrice: Math.round(40000 / 12), runsCap: null, overagePerRun: 0 },
  pilot: { monthlyPrice: 250, runsCap: 20, overagePerRun: 0 },
};

export const DEFAULT_RUNS_PER_MONTH: Record<PlanId, number> = {
  starter: 30,
  growth: 80,
  enterprise: 120,
  pilot: 12,
};

export function normalizePlanId(value: unknown): PlanId {
  const id = String(value ?? "growth");
  if (id === "starter" || id === "growth" || id === "enterprise" || id === "pilot") {
    return id;
  }
  return "growth";
}
