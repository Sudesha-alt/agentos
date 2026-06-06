import type { PipelineStage, PipelineStatus, StageStatus } from "../../contracts";

export const DATA_MODES = {
  MOCK: "mock",
  REST: "rest",
} as const;

export const DATA_MODE =
  import.meta.env.VITE_API_MODE === DATA_MODES.REST
    ? DATA_MODES.REST
    : DATA_MODES.MOCK;

/** Flat list for breadcrumbs and mobile nav. */
export const APP_NAV = [
  { to: "/app", label: "Command Center", breadcrumb: "Command Center", end: true },
  { to: "/app/pipelines", label: "Pipeline Explorer", breadcrumb: "Pipelines" },
  { to: "/app/codebase", label: "Codebase", breadcrumb: "Codebase" },
  { to: "/app/qa", label: "QA Center", breadcrumb: "QA Center" },
  { to: "/app/costs", label: "Cost Intelligence", breadcrumb: "Costs" },
  { to: "/app/audit", label: "Audit Trail", breadcrumb: "Audit" },
  { to: "/app/settings", label: "Configuration", breadcrumb: "Configuration" },
  { to: "/app/git", label: "GitHub integration", breadcrumb: "GitHub" },
  { to: "/app/jira", label: "Jira integration", breadcrumb: "Jira" },
  { to: "/app/jira-search", label: "Board search", breadcrumb: "Search" },
] as const;

/** Sidebar groups aligned to the UX blueprint personas. */
export const APP_NAV_SECTIONS = [
  {
    id: "executive",
    label: "Executive",
    items: [
      { to: "/app", label: "Command Center", breadcrumb: "Command Center", end: true },
      { to: "/app/costs", label: "Cost Intelligence", breadcrumb: "Costs" },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      { to: "/app/pipelines", label: "Pipeline Explorer", breadcrumb: "Pipelines" },
      { to: "/app/codebase", label: "Codebase Intelligence", breadcrumb: "Codebase" },
      { to: "/app/qa", label: "QA Center", breadcrumb: "QA" },
    ],
  },
  {
    id: "compliance",
    label: "Compliance",
    items: [{ to: "/app/audit", label: "Audit Trail", breadcrumb: "Audit" }],
  },
  {
    id: "admin",
    label: "Admin",
    items: [
      { to: "/app/settings", label: "Configuration", breadcrumb: "Configuration" },
      { to: "/app/git", label: "GitHub integration", breadcrumb: "GitHub" },
      { to: "/app/jira", label: "Jira integration", breadcrumb: "Jira" },
      { to: "/app/jira-search", label: "Board search", breadcrumb: "Search" },
    ],
  },
] as const;

export const STAGE_ORDER: PipelineStage[] = [
  "INGESTION",
  "PRODUCT_AGENT",
  "PRD_VALIDATION",
  "ENGINEERING_AGENT",
  "IMPLEMENTATION_VALIDATION",
  "QA_AGENT",
  "QA_VALIDATION",
  "OUTPUT",
];

export const STAGE_LABELS: Record<PipelineStage, string> = {
  INGESTION: "Ingestion",
  PRODUCT_AGENT: "Discovery",
  PRD_VALIDATION: "PRD Gate",
  ENGINEERING_AGENT: "Engineering",
  IMPLEMENTATION_VALIDATION: "Impl. Gate",
  QA_AGENT: "QA Agent",
  QA_VALIDATION: "QA Gate",
  OUTPUT: "Writeback",
};

export const STATUS_LABELS: Record<PipelineStatus | StageStatus, string> = {
  RUNNING: "Running",
  PAUSED: "Awaiting human",
  COMPLETED: "Completed",
  FAILED: "Failed",
  PENDING: "Pending",
  AWAITING_HUMAN: "Awaiting human",
};

export const STATUS_TONES: Record<PipelineStatus | StageStatus, string> = {
  RUNNING: "indigo",
  PAUSED: "warning",
  COMPLETED: "success",
  FAILED: "danger",
  PENDING: "muted",
  AWAITING_HUMAN: "warning",
};

export const EDITORIAL_METRICS = {
  maxPageWidth: "max-w-[82rem]",
  maxProseWidth: "max-w-[70rem]",
};
