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

export type AgentNavId = "virin" | "ananta" | "neel";

export type NavSubItem = {
  label: string;
  to: string;
  tab?: string;
};

/** Three agent personas — sub-nav reveals on expand in sidebar. */
export const AGENT_NAV: Array<{
  id: AgentNavId;
  to: string;
  label: string;
  breadcrumb: string;
  subNav: NavSubItem[];
}> = [
  {
    id: "virin",
    to: "/app/pm-agents",
    label: AGENT_NAMES.VIRIN,
    breadcrumb: AGENT_NAMES.VIRIN,
    subNav: [
      { label: "Workspace", to: "/app/pm-agents" },
      { label: "Roadmap", to: "/app/roadmap" },
    ],
  },
  {
    id: "ananta",
    to: "/app/ananta",
    label: AGENT_NAMES.ANANTA,
    breadcrumb: AGENT_NAMES.ANANTA,
    subNav: [{ label: "Workspace", to: "/app/ananta" }],
  },
  {
    id: "neel",
    to: "/app/qa",
    label: AGENT_NAMES.NEEL,
    breadcrumb: AGENT_NAMES.NEEL,
    subNav: [],
  },
];

/** @deprecated Ananta no longer has tabbed sub-nav */
export const TECH_AGENT_SUB_NAV = AGENT_NAV.find((a) => a.id === "ananta")!.subNav;

/** Flat list for breadcrumbs and mobile nav. */
export const APP_NAV = [
  { to: "/app", label: "Dashboard", breadcrumb: "Dashboard", end: true },
  { to: "/app/pipelines", label: "Pipelines", breadcrumb: "Pipelines" },
  ...AGENT_NAV.map(({ to, label, breadcrumb }) => ({ to, label, breadcrumb })),
  { to: "/app/costs", label: "Cost & ROI", breadcrumb: "Costs" },
  { to: "/app/settings", label: "Configuration", breadcrumb: "Settings" },
  { to: "/app/audit", label: "Audit Trail", breadcrumb: "Audit" },
] as const;

export type PipelineNavTab = "active" | "review" | "history";

export const PIPELINE_SUB_NAV: Array<{
  tab: PipelineNavTab;
  label: string;
  to: string;
  badgeKey: "active" | "review" | null;
}> = [
  { tab: "active", label: "Active", to: "/app/pipelines?tab=active", badgeKey: "active" },
  {
    tab: "review",
    label: "Review Queue",
    to: "/app/pipelines?tab=review",
    badgeKey: "review",
  },
  { tab: "history", label: "History", to: "/app/pipelines?tab=history", badgeKey: null },
];

/** Sidebar groups — post-login landing UX. */
export const APP_NAV_SECTIONS = [
  {
    id: "workspace",
    label: "Workspace",
    items: [{ to: "/app", label: "Dashboard", breadcrumb: "Dashboard", end: true }],
    pipelineGroup: true,
  },
  {
    id: "agents",
    label: "Agents",
    agentGroup: true,
    items: AGENT_NAV.map(({ id, to, label, breadcrumb, subNav }) => ({
      id,
      to,
      label,
      breadcrumb,
      subNav,
    })),
  },
  {
    id: "analytics",
    label: "Analytics",
    items: [{ to: "/app/costs", label: "Cost & ROI", breadcrumb: "Costs" }],
  },
  {
    id: "settings",
    label: "Settings",
    items: [
      { to: "/app/settings", label: "Configuration", breadcrumb: "Settings" },
      { to: "/app/audit", label: "Audit Trail", breadcrumb: "Audit" },
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

/** Consistent state colours across dashboard and engineering agent. */
export const STATE_COLORS = {
  running: "text-indigo border-indigo/40 bg-indigo/5",
  attention: "text-warning border-warning/50 bg-warning/10",
  success: "text-success border-success/40 bg-success/10",
  failed: "text-danger border-danger/40 bg-danger/10",
  agent: "text-violet-700 border-violet-300/60 bg-violet-50",
} as const;

export const EDITORIAL_METRICS = {
  maxPageWidth: "max-w-[82rem]",
  maxProseWidth: "max-w-[70rem]",
};
