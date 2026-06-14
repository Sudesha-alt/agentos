import type { PipelineStage, PipelineStatus, StageStatus } from "../../contracts";

export const DATA_MODES = {
  MOCK: "mock",
  REST: "rest",
} as const;

export const DATA_MODE =
  import.meta.env.VITE_API_MODE === DATA_MODES.REST
    ? DATA_MODES.REST
    : DATA_MODES.MOCK;

export const AGENT_NAMES = {
  VIRIN: "Virin",
  ANANTA: "Ananta",
  NEEL: "Neel",
} as const;

/** Agent modules — Virin (product), Ananta (tech), Neel (QA). */
export const AGENT_NAV = [
  {
    to: "/app/pm-agents",
    label: AGENT_NAMES.VIRIN,
    breadcrumb: AGENT_NAMES.VIRIN,
    role: "Product",
  },
  {
    to: "/app/codebase",
    label: AGENT_NAMES.ANANTA,
    breadcrumb: AGENT_NAMES.ANANTA,
    role: "Tech",
  },
  { to: "/app/qa", label: AGENT_NAMES.NEEL, breadcrumb: AGENT_NAMES.NEEL, role: "QA" },
] as const;

/** Flat list for breadcrumbs and mobile nav. */
export const APP_NAV = [
  { to: "/app", label: "Command Center", breadcrumb: "Command Center", end: true },
  { to: "/app/pipelines", label: "Pipeline Explorer", breadcrumb: "Pipelines" },
  ...AGENT_NAV.map(({ to, label, breadcrumb }) => ({ to, label, breadcrumb })),
  { to: "/app/costs", label: "Cost Intelligence", breadcrumb: "Costs" },
  { to: "/app/audit", label: "Audit Trail", breadcrumb: "Audit" },
  { to: "/app/settings", label: "Settings", breadcrumb: "Settings" },
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
    id: "agents",
    label: "Agents",
    items: AGENT_NAV.map(({ to, label, breadcrumb }) => ({ to, label, breadcrumb })),
  },
  {
    id: "operations",
    label: "Operations",
    items: [
      { to: "/app/pipelines", label: "Pipeline Explorer", breadcrumb: "Pipelines" },
      {
        to: "/app/org-intelligence",
        label: "Org Intelligence",
        breadcrumb: "Org Intelligence",
      },
    ],
  },
  {
    id: "compliance",
    label: "Compliance",
    items: [{ to: "/app/audit", label: "Audit Trail", breadcrumb: "Audit" }],
  },
  {
    id: "admin",
    label: "Settings",
    items: [
      { to: "/app/settings", label: "Workspace settings", breadcrumb: "Settings" },
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
  PRODUCT_AGENT: AGENT_NAMES.VIRIN,
  PRD_VALIDATION: "PRD Gate",
  ENGINEERING_AGENT: AGENT_NAMES.ANANTA,
  IMPLEMENTATION_VALIDATION: "Impl. Gate",
  QA_AGENT: AGENT_NAMES.NEEL,
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
