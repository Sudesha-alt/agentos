import type { PipelineStage, PipelineStatus, StageStatus } from "../../contracts";
import { orgPath } from "../routing/orgPaths";

export const DATA_MODES = {
  MOCK: "mock",
  REST: "rest",
} as const;

/** Use REST when explicitly set, or when VITE_API_URL is configured (production). */
function resolveDataMode(): (typeof DATA_MODES)[keyof typeof DATA_MODES] {
  const explicit = import.meta.env.VITE_API_MODE as string | undefined;
  if (explicit === DATA_MODES.MOCK) return DATA_MODES.MOCK;
  if (explicit === DATA_MODES.REST) return DATA_MODES.REST;
  if (import.meta.env.VITE_API_URL?.trim()) return DATA_MODES.REST;
  return DATA_MODES.MOCK;
}

export const DATA_MODE = resolveDataMode();

export const AGENT_NAMES = {
  VIRIN: "Virin",
  ANANTA: "Ananta",
  NEEL: "Neel",
} as const;

export type AgentNavId = "virin" | "ananta" | "neel";

/** Dashboard / health panel labels with role suffix. */
export const AGENT_DASHBOARD_LABELS: Record<AgentNavId, string> = {
  virin: `${AGENT_NAMES.VIRIN} (-PM)`,
  ananta: `${AGENT_NAMES.ANANTA} (-Engg)`,
  neel: `${AGENT_NAMES.NEEL} (-QA)`,
};

export function getAgentDashboardLabel(id: string): string {
  if (id in AGENT_DASHBOARD_LABELS) {
    return AGENT_DASHBOARD_LABELS[id as AgentNavId];
  }
  return id;
}

export type NavSubItem = {
  label: string;
  to: string;
  tab?: string;
};

/** Three agent personas — sub-nav reveals on expand in sidebar. */
export function buildAgentNav(slug: string): Array<{
  id: AgentNavId;
  to: string;
  label: string;
  breadcrumb: string;
  subNav: NavSubItem[];
}> {
  return [
    {
      id: "virin",
      to: orgPath(slug, "pm-agents"),
      label: AGENT_NAMES.VIRIN,
      breadcrumb: AGENT_NAMES.VIRIN,
      subNav: [
        { label: "Workspace", to: orgPath(slug, "pm-agents") },
        { label: "Roadmap", to: orgPath(slug, "roadmap") },
      ],
    },
    {
      id: "ananta",
      to: orgPath(slug, "ananta"),
      label: AGENT_NAMES.ANANTA,
      breadcrumb: AGENT_NAMES.ANANTA,
      subNav: [{ label: "Workspace", to: orgPath(slug, "ananta") }],
    },
    {
      id: "neel",
      to: orgPath(slug, "qa"),
      label: AGENT_NAMES.NEEL,
      breadcrumb: AGENT_NAMES.NEEL,
      subNav: [],
    },
  ];
}

/** @deprecated Use buildAgentNav(slug) */
export const AGENT_NAV = buildAgentNav("app");

/** @deprecated Ananta no longer has tabbed sub-nav */
export const TECH_AGENT_SUB_NAV = buildAgentNav("app").find((a) => a.id === "ananta")!.subNav;

/** Flat list for breadcrumbs and mobile nav. */
export function buildAppNav(slug: string) {
  const agentNav = buildAgentNav(slug);
  return [
    { to: orgPath(slug), label: "Dashboard", breadcrumb: "Dashboard", end: true },
    { to: orgPath(slug, "pipelines"), label: "Pipelines", breadcrumb: "Pipelines" },
    ...agentNav.map(({ to, label, breadcrumb }) => ({ to, label, breadcrumb })),
    { to: orgPath(slug, "costs"), label: "Cost & ROI", breadcrumb: "Costs" },
    { to: orgPath(slug, "settings"), label: "Configuration", breadcrumb: "Settings" },
    { to: orgPath(slug, "audit"), label: "Audit Trail", breadcrumb: "Audit" },
  ];
}

/** @deprecated Use buildAppNav(slug) */
export const APP_NAV = buildAppNav("app");

export type PipelineNavTab = "active" | "review" | "history";

export function buildPipelineSubNav(slug: string): Array<{
  tab: PipelineNavTab;
  label: string;
  to: string;
  badgeKey: "active" | "review" | null;
}> {
  return [
    {
      tab: "active",
      label: "Active",
      to: `${orgPath(slug, "pipelines")}?tab=active`,
      badgeKey: "active",
    },
    {
      tab: "review",
      label: "Review Queue",
      to: `${orgPath(slug, "pipelines")}?tab=review`,
      badgeKey: "review",
    },
    {
      tab: "history",
      label: "History",
      to: `${orgPath(slug, "pipelines")}?tab=history`,
      badgeKey: null,
    },
  ];
}

/** @deprecated Use buildPipelineSubNav(slug) */
export const PIPELINE_SUB_NAV = buildPipelineSubNav("app");

/** Sidebar groups — post-login landing UX. */
export function buildAppNavSections(slug: string) {
  const agentNav = buildAgentNav(slug);
  return [
    {
      id: "workspace",
      label: "Workspace",
      items: [{ to: orgPath(slug), label: "Dashboard", breadcrumb: "Dashboard", end: true }],
      pipelineGroup: true,
    },
    {
      id: "agents",
      label: "Agents",
      agentGroup: true,
      items: agentNav.map(({ id, to, label, breadcrumb, subNav }) => ({
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
      items: [{ to: orgPath(slug, "costs"), label: "Cost & ROI", breadcrumb: "Costs" }],
    },
    {
      id: "settings",
      label: "Settings",
      items: [
        { to: orgPath(slug, "settings"), label: "Configuration", breadcrumb: "Settings" },
        { to: orgPath(slug, "audit"), label: "Audit Trail", breadcrumb: "Audit" },
      ],
    },
  ];
}

/** @deprecated Use buildAppNavSections(slug) */
export const APP_NAV_SECTIONS = buildAppNavSections("app");

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
