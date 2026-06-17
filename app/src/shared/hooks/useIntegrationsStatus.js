import { useMemo } from "react";
import { useGitIntegrationSummary } from "../../entities/git-integration";
import { usePipelineJiraSetup } from "../../entities/pipeline-jira";
import {
  buildIntegrationsCatalog,
  groupIntegrationsByCategory,
} from "../config/integrationsCatalog";
import { useOrgOptional } from "../providers/OrgRouteProvider";

function resolveDisplayStatus(integration, live) {
  if (integration.catalogStatus === "coming_soon") {
    return "coming_soon";
  }
  if (integration.liveStatusKey === "github") {
    if (live.githubConnected) return "connected";
    if (live.githubNeedsSetup) return "setup_incomplete";
    return "not_connected";
  }
  if (integration.liveStatusKey === "jira") {
    return live.jiraConnected ? "connected" : "not_connected";
  }
  return "not_connected";
}

export function useIntegrationsStatus() {
  const org = useOrgOptional();
  const orgSlug = org?.orgSlug ?? "workspace";
  const { data: git, loading: gitLoading } = useGitIntegrationSummary({ pollMs: 12000 });
  const { data: jira, loading: jiraLoading } = usePipelineJiraSetup({ pollMs: 12000 });

  const live = useMemo(
    () => ({
      githubConnected: Boolean(git?.connected),
      githubNeedsSetup: Boolean(
        !git?.connected && (git?.needsRepoSelection || git?.installationDetected)
      ),
      jiraConnected: Boolean(jira?.connected),
    }),
    [git?.connected, git?.needsRepoSelection, git?.installationDetected, jira?.connected]
  );

  const integrations = useMemo(
    () =>
      buildIntegrationsCatalog(orgSlug).map((item) => ({
        ...item,
        displayStatus: resolveDisplayStatus(item, live),
      })),
    [live, orgSlug]
  );

  const grouped = useMemo(() => groupIntegrationsByCategory(integrations), [integrations]);

  return {
    integrations,
    grouped,
    loading: gitLoading || jiraLoading,
  };
}
