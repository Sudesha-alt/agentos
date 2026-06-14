/** Public SaaS tiers (Pilot is internal — see PILOT_PLAN). */
export const PIPELINE_RUN_DEFINITION =
  "A pipeline run is counted each time a ticket completes discovery and produces a PRD — regardless of whether it proceeds to Engineering or QA. Tickets that fail validation and are revised do not count as additional runs.";

export const BILLING_PLANS = [
  {
    id: "starter",
    name: "Starter",
    priceLabel: "$1,999",
    period: "month",
    tagline: "For teams getting started with AI-powered development workflows",
    included: [
      "Up to 40 pipeline runs per month",
      "Product, Engineering & QA Agents",
      "1 connected repository",
      "Jira integration",
      "Email notifications",
      "PRD generation with validation gates",
      "QA test generation & execution",
      "Standard codebase indexing",
      "30-day audit trail history",
    ],
    overage: "$40 per additional pipeline run",
    bestFor: "Teams of 10–30 engineers running their first features through the pipeline",
    popular: false,
  },
  {
    id: "growth",
    name: "Growth",
    priceLabel: "$4,999",
    period: "month",
    tagline: "For teams scaling AI-assisted development across their codebase",
    included: [
      "Everything in Starter, plus:",
      "Up to 150 pipeline runs per month",
      "Up to 5 connected repositories",
      "Codebase Intelligence Layer — visual map, semantic search, AI tour",
      "Branch tracking & human-change detection",
      "Slack integration with actionable approvals",
      "Cost Intelligence dashboard & ROI tracking",
      "Custom validation gate thresholds",
      "90-day audit trail history",
      "Priority email support",
    ],
    overage: "$35 per additional pipeline run",
    bestFor: "Teams of 50–150 engineers running AI agents as part of standard workflow",
    popular: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceLabel: "Custom",
    priceSub: "starting at $40,000/year",
    period: null,
    tagline: "For organizations requiring scale, security, and compliance",
    included: [
      "Everything in Growth, plus:",
      "Unlimited pipeline runs (fair-use)",
      "Unlimited repositories — multi-repo intelligence",
      "Compliance & audit reports (SOC2-ready exports)",
      "SSO / SAML",
      "Dedicated Slack channel + onboarding support",
      "Custom agent configuration & prompt tuning",
      "Unlimited audit trail history",
      "VPC / on-prem deployment options",
      "Dedicated success manager",
    ],
    overage: null,
    bestFor: "150+ engineers, regulated industries, multi-team rollouts",
    popular: false,
  },
];

/** Hidden sales tier — not shown on public marketing pricing. */
export const PILOT_PLAN = {
  id: "pilot",
  name: "Pilot",
  priceLabel: "$0–500",
  period: "month",
  pipelineRunsCap: 20,
  durationDays: 90,
  description: "Design partner program — capped usage, time-limited. Converts cleanly to a paid tier.",
};

export const BILLING_ADDONS = [
  { name: "Microsoft Teams integration", price: "$200/month" },
  { name: "Additional repository (Growth tier)", price: "$300/month" },
  { name: "Extended audit retention (1 year)", price: "$150/month" },
];

export const PLAN_COMPARISON_ROWS = [
  { feature: "Pipeline runs/month", starter: "40", growth: "150", enterprise: "Unlimited" },
  { feature: "Connected repositories", starter: "1", growth: "5", enterprise: "Unlimited" },
  { feature: "Product, Engineering, QA Agents", starter: true, growth: true, enterprise: true },
  { feature: "Codebase Intelligence Map", starter: false, growth: true, enterprise: true },
  { feature: "Semantic Search & AI Tour", starter: false, growth: true, enterprise: true },
  { feature: "Slack Integration", starter: false, growth: true, enterprise: true },
  { feature: "Microsoft Teams", starter: "Add-on", growth: "Add-on", enterprise: true },
  { feature: "Cost Intelligence Dashboard", starter: false, growth: true, enterprise: true },
  { feature: "Custom Validation Gates", starter: false, growth: true, enterprise: true },
  { feature: "Compliance Reports", starter: false, growth: false, enterprise: true },
  { feature: "SSO/SAML", starter: false, growth: false, enterprise: true },
  { feature: "Audit Trail Retention", starter: "30 days", growth: "90 days", enterprise: "Unlimited" },
  { feature: "Support", starter: "Email", growth: "Priority Email", enterprise: "Dedicated Manager" },
];

export function planRoiCalculatorHref(planId) {
  const params = new URLSearchParams({ plan: planId ?? "growth" });
  return `/app/costs?${params.toString()}`;
}

/** Structured tier economics for ROI calculator — sync with server/src/roi/assumptions.ts */
export const PLAN_PRICING = {
  starter: { monthlyPrice: 1999, runsCap: 40, overagePerRun: 40 },
  growth: { monthlyPrice: 4999, runsCap: 150, overagePerRun: 35 },
  enterprise: { monthlyPrice: Math.round(40000 / 12), runsCap: null, overagePerRun: 0 },
  pilot: { monthlyPrice: 250, runsCap: 20, overagePerRun: 0 },
};

export const DEFAULT_RUNS_PER_MONTH = {
  starter: 30,
  growth: 80,
  enterprise: 120,
  pilot: 12,
};
