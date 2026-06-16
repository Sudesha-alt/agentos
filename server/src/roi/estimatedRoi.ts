import {
  DEFAULT_ROI_ASSUMPTIONS,
  DEFAULT_RUNS_PER_MONTH,
  PLAN_PRICING,
  normalizePlanId,
} from "./assumptions";
import type { EstimatedRoiInputs, RoiResult } from "./types";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundRatio(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Estimated ROI model (v1):
 * hoursSavedPerRun = baselineHours × stageSavingsSum × (1 + reworkRate × reworkMultiplier) × velocityFactor
 * baselineHoursPerRun is human labor saved per agent run — NOT agent pipeline runtime.
 * velocityFactor scales the human baseline by sprint length — NOT agent execution speed.
 */
export function computeEstimatedRoi(raw: Partial<EstimatedRoiInputs>): RoiResult {
  const assumptions = DEFAULT_ROI_ASSUMPTIONS;
  const planId = normalizePlanId(raw.planId);
  const pricing = PLAN_PRICING[planId];

  const teamSize = Math.max(1, Number(raw.teamSize) || 10);
  const hourlyRate = Math.max(1, Number(raw.hourlyRate) || 150);
  const pipelineRunsPerMonth = Math.max(
    1,
    Number(raw.pipelineRunsPerMonth) || DEFAULT_RUNS_PER_MONTH[planId]
  );
  const sprintWeeks = Math.max(0.5, Number(raw.sprintWeeks) || assumptions.defaultSprintWeeks);
  const reworkRate = Math.min(1, Math.max(0, Number(raw.reworkRate) || 0.25));
  const baselineHoursPerRun = Math.max(
    1,
    Number(raw.baselineHoursPerRun) || assumptions.baselineHoursPerRun
  );

  const stageSavingsSum =
    assumptions.productSavingsPct +
    assumptions.engineeringSavingsPct +
    assumptions.qaSavingsPct;
  const velocityFactor = sprintWeeks / assumptions.defaultSprintWeeks;
  const reworkFactor = 1 + reworkRate * assumptions.reworkMultiplier;
  const teamScale = Math.min(1.5, 1 + (teamSize - 10) * 0.01);

  const hoursSavedPerRun = roundMoney(
    baselineHoursPerRun * stageSavingsSum * reworkFactor * velocityFactor * teamScale
  );

  const annualLaborSavings = roundMoney(
    hoursSavedPerRun * pipelineRunsPerMonth * 12 * hourlyRate
  );

  const annualSubscription = roundMoney(pricing.monthlyPrice * 12);
  const overageRunsPerMonth =
    pricing.runsCap == null
      ? 0
      : Math.max(0, pipelineRunsPerMonth - pricing.runsCap);
  const annualOverage = roundMoney(overageRunsPerMonth * pricing.overagePerRun * 12);
  const annualAgentSpend = 0;
  const totalAnnualCost = roundMoney(
    annualSubscription + annualOverage + annualAgentSpend
  );
  const netAnnualBenefit = roundMoney(annualLaborSavings - totalAnnualCost);
  const roiMultiple =
    totalAnnualCost > 0 ? roundRatio(annualLaborSavings / totalAnnualCost) : 0;
  const monthlySavings = annualLaborSavings / 12;
  const paybackMonths =
    monthlySavings > 0 ? roundRatio(totalAnnualCost / monthlySavings) : null;

  return {
    mode: "estimated",
    planId,
    teamSize,
    hourlyRate,
    pipelineRunsPerMonth,
    sprintWeeks,
    reworkRate,
    hoursSavedPerRun,
    annualLaborSavings,
    annualSubscription,
    annualOverage,
    annualAgentSpend,
    totalAnnualCost,
    netAnnualBenefit,
    roiMultiple,
    paybackMonths,
    assumptions: {
      ...assumptions,
      planRunsCap: pricing.runsCap,
      monthlyPrice: pricing.monthlyPrice,
      overagePerRun: pricing.overagePerRun,
    },
  };
}
