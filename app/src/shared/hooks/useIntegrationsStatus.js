import { useMemo } from "react";
import { useGitIntegrationSummary } from "../../entities/git-integration";
import { usePipelineJiraSetup } from "../../entities/pipeline-jira";
import {
  INTEGRATIONS_CATALOG,
  groupIntegrationsByCategory,
} from "../config/integrationsCatalog";

function resolveDisplayStatus(integration, live) {
  if (integration.catalogStatus === "coming_soon") {
    return "coming_soon";
  }
  if (integration.liveStatusKey === "github") {
    return live.githubConnected ? "connected" : "not_connected";
  }
  if (integration.liveStatusKey === "jira") {
    return live.jiraConnected ? "connected" : "not_connected";
  }
  return "not_connected";
}

export function useIntegrationsStatus() {
  const { data: git, loading: gitLoading } = useGitIntegrationSummary({ pollMs: 12000 });
  const { data: jira, loading: jiraLoading } = usePipelineJiraSetup({ pollMs: 12000 });

  const live = useMemo(
    () => ({
      githubConnected: Boolean(git?.connected),
      jiraConnected: Boolean(jira?.connected),
    }),
    [git?.connected, jira?.connected]
  );

  const integrations = useMemo(
    () =>
      INTEGRATIONS_CATALOG.map((item) => ({
        ...item,
        displayStatus: resolveDisplayStatus(item, live),
      })),
    [live]
  );

  const grouped = useMemo(() => groupIntegrationsByCategory(integrations), [integrations]);

  return {
    integrations,
    grouped,
    loading: gitLoading || jiraLoading,
  };
}
