import { DEFAULT_RUNS_PER_MONTH, PLAN_PRICING } from "../config/billingPlans";

/** Plans shown in the dashboard cost estimator (Cofounder-style UX, AgentOS pricing). */
export const ESTIMATOR_PLANS = [
  {
    id: "pilot",
    name: "Free Trial",
    priceLabel: "$0",
    includedLabel: "$10 included usage",
    accessWindow: "7 days",
    cta: "Get started",
  },
  {
    id: "starter",
    name: "Starter",
    priceLabel: "$1,999",
    includedLabel: "$1,999 included usage",
    accessWindow: "Ongoing",
    cta: "Get started",
  },
  {
    id: "growth",
    name: "Growth",
    priceLabel: "$4,999",
    includedLabel: "$4,999 included usage",
    accessWindow: "Ongoing",
    cta: "Get started",
  },
];

/**
 * @param {{ planId: string, businessScale: number }} input businessScale 1–10
 */
export function computeMonthlyCostEstimate({ planId, businessScale }) {
  const scale = Math.min(10, Math.max(1, Number(businessScale) || 1));
  const pricing = PLAN_PRICING[planId] ?? PLAN_PRICING.growth;
  const baseMonthly = planId === "pilot" ? 0 : pricing.monthlyPrice;

  const agentCount = Math.round(3 + scale * 1.2);
  const pipelineRuns = Math.round(
    (DEFAULT_RUNS_PER_MONTH[planId] ?? 30) + scale * 4
  );

  const tokenCost = Math.round(scale * (planId === "growth" ? 14 : 10));
  const computeCost = Math.round(scale * (planId === "growth" ? 10 : 6));
  const databaseCost = planId === "pilot" ? 0 : Math.round(scale * 2);
  const customerSupport = planId === "growth" ? 0 : 0;
  const adSpend = 0;
  const dataPurchasing = 0;

  let overageCost = 0;
  if (pricing.runsCap != null && pipelineRuns > pricing.runsCap) {
    overageCost = (pipelineRuns - pricing.runsCap) * pricing.overagePerRun;
  }

  const usageBeyondIncluded = tokenCost + computeCost + databaseCost + overageCost;
  const total = baseMonthly + usageBeyondIncluded;

  return {
    planId,
    businessScale: scale,
    baseMonthly,
    includedUsage: planId === "pilot" ? 10 : baseMonthly,
    agentCount,
    pipelineRuns,
    tokenCost,
    computeCost,
    databaseCost,
    customerSupport,
    adSpend,
    dataPurchasing,
    overageCost,
    total,
  };
}

export const PLAN_FEATURE_MATRIX = [
  {
    group: "Plan access",
    rows: [
      { label: "Access window", pilot: "7 days", starter: "Ongoing", growth: "Ongoing" },
      {
        label: "Included usage",
        pilot: "$10",
        starter: "$1,999 / month",
        growth: "$4,999 / month",
      },
    ],
  },
  {
    group: "AgentOS pipeline",
    rows: [
      { label: "Multiple AI models", pilot: true, starter: true, growth: true },
      { label: "Build workflow", pilot: true, starter: true, growth: true },
      { label: "Agent-built previews", pilot: true, starter: true, growth: true },
      { label: "Preview environments", pilot: true, starter: true, growth: true },
      { label: "Agent inboxes", pilot: true, starter: true, growth: true },
      { label: "Human approval flow", pilot: true, starter: true, growth: true },
    ],
  },
  {
    group: "Managed services",
    rows: [
      { label: "Hosted database and auth", pilot: "Limited", starter: true, growth: true },
      { label: "Deployment", pilot: "Limited", starter: true, growth: true },
      { label: "Domains, hosting, secrets", pilot: false, starter: true, growth: true },
      { label: "Email hosting", pilot: false, starter: true, growth: true },
      { label: "Data enrichment", pilot: false, starter: false, growth: true },
      { label: "Image and video services", pilot: false, starter: false, growth: true },
    ],
  },
  {
    group: "Go-to-market",
    rows: [
      { label: "ICP and sales workflow", pilot: false, starter: false, growth: true },
      { label: "Brand creation", pilot: false, starter: false, growth: true },
      { label: "CRM and outreach setup", pilot: false, starter: false, growth: true },
      { label: "Content and campaign assets", pilot: false, starter: false, growth: true },
      { label: "Social integrations", pilot: false, starter: false, growth: true },
    ],
  },
  {
    group: "Ownership and support",
    rows: [
      { label: "Graduate project ownership", pilot: true, starter: true, growth: true },
      { label: "Use your own codebase", pilot: true, starter: true, growth: true },
      { label: "Multiplayer", pilot: "Limited", starter: true, growth: true },
      { label: "SOC 2", pilot: false, starter: false, growth: true },
      { label: "Priority support", pilot: false, starter: false, growth: true },
    ],
  },
];

export function formatEstimatorMoney(value) {
  if (value >= 1000) {
    return `$${Math.round(value).toLocaleString()}`;
  }
  return `$${Math.round(value)}`;
}
