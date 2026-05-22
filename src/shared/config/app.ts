import type { PipelineStage, PipelineStatus, StageStatus } from "../../contracts";

export const DATA_MODES = {
  MOCK: "mock",
  REST: "rest",
} as const;

export const DATA_MODE =
  import.meta.env.VITE_API_MODE === DATA_MODES.REST
    ? DATA_MODES.REST
    : DATA_MODES.MOCK;

export const APP_NAV = [
  { to: "/app", label: "Dashboard", breadcrumb: "Workspace", end: true },
  { to: "/app/pipelines", label: "Pipelines", breadcrumb: "Pipelines" },
  { to: "/app/ai-worker", label: "AI Worker", breadcrumb: "AI Worker" },
  { to: "/app/jira-search", label: "Board search", breadcrumb: "Board search" },
  { to: "/app/settings", label: "Settings", breadcrumb: "Settings" },
] as const;

/** Sidebar groups — keeps Jira intake distinct from the agent pipeline. */
export const APP_NAV_SECTIONS = [
  {
    id: "workflow",
    label: "Workflow",
    items: [
      { to: "/app", label: "Dashboard", breadcrumb: "Workspace", end: true },
      { to: "/app/pipelines", label: "Pipelines", breadcrumb: "Pipelines" },
      { to: "/app/settings", label: "Settings", breadcrumb: "Settings" },
    ],
  },
  {
    id: "jira",
    label: "Jira intake",
    items: [
      { to: "/app/ai-worker", label: "AI Worker", breadcrumb: "AI Worker" },
      { to: "/app/jira-search", label: "Board search", breadcrumb: "Board search" },
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
  PRODUCT_AGENT: "Product Agent",
  PRD_VALIDATION: "PRD Gate",
  ENGINEERING_AGENT: "Engineering Agent",
  IMPLEMENTATION_VALIDATION: "Implementation Gate",
  QA_AGENT: "QA Agent",
  QA_VALIDATION: "QA Gate",
  OUTPUT: "Jira writeback",
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
