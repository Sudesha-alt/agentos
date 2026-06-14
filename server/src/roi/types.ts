export type PlanId = "starter" | "growth" | "enterprise" | "pilot";

export interface RoiAssumptionsSnapshot {
  version: string;
  baselineHoursPerRun: number;
  productSavingsPct: number;
  engineeringSavingsPct: number;
  qaSavingsPct: number;
  reworkMultiplier: number;
  defaultSprintWeeks: number;
}

export interface EstimatedRoiInputs {
  planId: PlanId;
  teamSize: number;
  hourlyRate: number;
  pipelineRunsPerMonth: number;
  sprintWeeks: number;
  reworkRate: number;
  baselineHoursPerRun?: number;
}

export interface RoiResult {
  mode: "estimated" | "actual";
  planId: PlanId;
  teamSize: number;
  hourlyRate: number;
  pipelineRunsPerMonth: number;
  sprintWeeks: number;
  reworkRate: number;
  hoursSavedPerRun: number;
  annualLaborSavings: number;
  annualSubscription: number;
  annualOverage: number;
  annualAgentSpend: number;
  totalAnnualCost: number;
  netAnnualBenefit: number;
  roiMultiple: number;
  paybackMonths: number | null;
  assumptions: RoiAssumptionsSnapshot & {
    planRunsCap: number | null;
    monthlyPrice: number;
    overagePerRun: number;
  };
}

export interface FeatureRoiRow {
  jiraKey: string;
  title: string;
  tokens: number;
  cost: number;
  hoursSaved: number;
  roi: number;
}

export interface CostsSummary {
  monthSpend: number;
  avgPerFeature: number;
  costPerToken: number;
}

export interface CostsDailyDay {
  day: string;
  product: number;
  engineering: number;
  qa: number;
}
