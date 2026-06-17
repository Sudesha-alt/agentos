import { orgPath } from "../routing/orgPaths";

export const INTEGRATION_CATEGORIES = [
  { id: "source_control", label: "Source control" },
  { id: "issue_tracking", label: "Issue tracking" },
  { id: "data_storage", label: "Data & storage" },
  { id: "observability", label: "Observability & logs" },
  { id: "communication", label: "Communication" },
];

const INTEGRATION_DEFS = [
  {
    id: "github",
    name: "GitHub",
    category: "source_control",
    description:
      "GitHub App or PAT for codebase indexing, branch push, and QA sandboxes.",
    catalogStatus: "available",
    routeParts: ["settings", "integrations", "github"],
    icon: "/marketing/integrations/github-wordmark.svg",
    liveStatusKey: "github",
  },
  {
    id: "jira",
    name: "Jira",
    category: "issue_tracking",
    description:
      "AI Worker queue, webhooks, column mapping, and pipeline ingress from tickets.",
    catalogStatus: "available",
    routeParts: ["settings", "integrations", "jira"],
    icon: "/marketing/integrations/jira-wordmark.svg",
    liveStatusKey: "jira",
  },
  {
    id: "postgresql",
    name: "PostgreSQL",
    category: "data_storage",
    description:
      "Connect a managed Postgres database for pipeline artifacts, audit logs, and agent memory.",
    catalogStatus: "coming_soon",
    routeParts: ["settings", "integrations", "postgresql"],
    icon: null,
    liveStatusKey: null,
  },
  {
    id: "supabase",
    name: "Supabase",
    category: "data_storage",
    description: "Sync workspace data with Supabase Postgres, auth, and edge functions.",
    catalogStatus: "coming_soon",
    routeParts: ["settings", "integrations", "supabase"],
    icon: "/marketing/integrations/supabase-wordmark.svg",
    liveStatusKey: null,
  },
  {
    id: "datadog",
    name: "Datadog",
    category: "observability",
    description:
      "Stream agent traces, pipeline metrics, and error logs into Datadog dashboards.",
    catalogStatus: "coming_soon",
    routeParts: ["settings", "integrations", "datadog"],
    icon: null,
    liveStatusKey: null,
  },
  {
    id: "grafana",
    name: "Grafana",
    category: "observability",
    description: "Visualize pipeline throughput, agent latency, and cost signals in Grafana.",
    catalogStatus: "coming_soon",
    routeParts: ["settings", "integrations", "grafana"],
    icon: "/marketing/integrations/grafana-wordmark.svg",
    liveStatusKey: null,
  },
  {
    id: "sentry",
    name: "Sentry",
    category: "observability",
    description: "Capture QA canary failures and agent exceptions with Sentry issue tracking.",
    catalogStatus: "coming_soon",
    routeParts: ["settings", "integrations", "sentry"],
    icon: null,
    liveStatusKey: null,
  },
  {
    id: "slack",
    name: "Slack",
    category: "communication",
    description: "Post pipeline approvals, human gates, and agent summaries to Slack channels.",
    catalogStatus: "coming_soon",
    routeParts: ["settings", "integrations", "slack"],
    icon: null,
    liveStatusKey: null,
  },
  {
    id: "linear",
    name: "Linear",
    category: "issue_tracking",
    description: "Import Linear issues into the AI Worker queue with bidirectional status sync.",
    catalogStatus: "coming_soon",
    routeParts: ["settings", "integrations", "linear"],
    icon: null,
    liveStatusKey: null,
  },
];

export function buildIntegrationsCatalog(orgSlug) {
  return INTEGRATION_DEFS.map(({ routeParts, ...item }) => ({
    ...item,
    route: orgPath(orgSlug, ...routeParts),
  }));
}

/** @deprecated Use buildIntegrationsCatalog(orgSlug) */
export const INTEGRATIONS_CATALOG = buildIntegrationsCatalog("workspace");

export function getIntegrationById(id, orgSlug = "workspace") {
  return buildIntegrationsCatalog(orgSlug).find((item) => item.id === id) ?? null;
}

export function groupIntegrationsByCategory(integrations) {
  return INTEGRATION_CATEGORIES.map((category) => ({
    ...category,
    items: integrations.filter((item) => item.category === category.id),
  })).filter((group) => group.items.length > 0);
}
