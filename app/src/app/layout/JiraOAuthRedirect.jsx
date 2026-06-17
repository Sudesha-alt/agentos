import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useOrg } from "../../shared/providers/OrgRouteProvider";
import { orgPathMatches } from "../../shared/routing/orgPaths";

/**
 * Atlassian OAuth may land on org home with ?connected=1 or ?error=.
 * Forward to Jira integration settings.
 */
export default function JiraOAuthRedirect() {
  const location = useLocation();
  const navigate = useNavigate();
  const { orgSlug, orgPath } = useOrg();

  useEffect(() => {
    const path = location.pathname.replace(/\/$/, "") || "/";
    const integrationPath = orgPath("settings", "integrations", "jira");
    if (
      path === integrationPath ||
      orgPathMatches(path, orgSlug, "settings", "integrations", "jira") ||
      path === "/app/settings/integrations/jira"
    ) {
      return;
    }

    const params = new URLSearchParams(location.search);
    const hasJiraCallback =
      params.has("connected") ||
      (params.has("error") &&
        ["invalid_state", "connect_failed", "no_jira_site", "access_denied"].includes(
          params.get("error") ?? ""
        ));

    if (!hasJiraCallback) return;

    navigate(`${integrationPath}${location.search}`, { replace: true });
  }, [location.pathname, location.search, navigate, orgPath, orgSlug]);

  return null;
}
