export const INTEGRATION_CATEGORIES = [
  { id: "source_control", label: "Source control" },
  { id: "issue_tracking", label: "Issue tracking" },
  { id: "data_storage", label: "Data & storage" },
  { id: "observability", label: "Observability & logs" },
  { id: "communication", label: "Communication" },
];

/** Static catalog metadata; live connection status is merged at runtime. */
export const INTEGRATIONS_CATALOG = [
  {
    id: "github",
    name: "GitHub",
    category: "source_control",
    description:
      "GitHub App or PAT for codebase indexing, branch push, and QA sandboxes.",
    catalogStatus: "available",
    route: "/app/settings/integrations/github",
    icon: "/marketing/integrations/github.png",
    liveStatusKey: "github",
  },
  {
    id: "jira",
    name: "Jira",
    category: "issue_tracking",
    description:
      "AI Worker queue, webhooks, column mapping, and pipeline ingress from tickets.",
    catalogStatus: "available",
    route: "/app/settings/integrations/jira",
    icon: "/marketing/integrations/jira.png",
    liveStatusKey: "jira",
  },
  {
    id: "postgresql",
    name: "PostgreSQL",
    category: "data_storage",
    description:
      "Connect a managed Postgres database for pipeline artifacts, audit logs, and agent memory.",
    catalogStatus: "coming_soon",
    route: "/app/settings/integrations/postgresql",
    icon: null,
    liveStatusKey: null,
  },
  {
    id: "supabase",
    name: "Supabase",
    category: "data_storage",
    description: "Sync workspace data with Supabase Postgres, auth, and edge functions.",
    catalogStatus: "coming_soon",
    route: "/app/settings/integrations/supabase",
    icon: "/marketing/integrations/supabase.png",
    liveStatusKey: null,
  },
  {
    id: "datadog",
    name: "Datadog",
    category: "observability",
    description:
      "Stream agent traces, pipeline metrics, and error logs into Datadog dashboards.",
    catalogStatus: "coming_soon",
    route: "/app/settings/integrations/datadog",
    icon: null,
    liveStatusKey: null,
  },
  {
    id: "grafana",
    name: "Grafana",
    category: "observability",
    description: "Visualize pipeline throughput, agent latency, and cost signals in Grafana.",
    catalogStatus: "coming_soon",
    route: "/app/settings/integrations/grafana",
    icon: "/marketing/integrations/grafana.png",
    liveStatusKey: null,
  },
  {
    id: "sentry",
    name: "Sentry",
    category: "observability",
    description: "Capture QA canary failures and agent exceptions with Sentry issue tracking.",
    catalogStatus: "coming_soon",
    route: "/app/settings/integrations/sentry",
    icon: null,
    liveStatusKey: null,
  },
  {
    id: "slack",
    name: "Slack",
    category: "communication",
    description: "Post pipeline approvals, human gates, and agent summaries to Slack channels.",
    catalogStatus: "coming_soon",
    route: "/app/settings/integrations/slack",
    icon: null,
    liveStatusKey: null,
  },
  {
    id: "linear",
    name: "Linear",
    category: "issue_tracking",
    description: "Import Linear issues into the AI Worker queue with bidirectional status sync.",
    catalogStatus: "coming_soon",
    route: "/app/settings/integrations/linear",
    icon: null,
    liveStatusKey: null,
  },
];

export function getIntegrationById(id) {
  return INTEGRATIONS_CATALOG.find((item) => item.id === id) ?? null;
}

export function groupIntegrationsByCategory(integrations) {
  return INTEGRATION_CATEGORIES.map((category) => ({
    ...category,
    items: integrations.filter((item) => item.category === category.id),
  })).filter((group) => group.items.length > 0);
}
