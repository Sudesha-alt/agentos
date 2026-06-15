import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * Atlassian OAuth may land on /app/ with ?connected=1 or ?error=.
 * Forward to Jira integration settings.
 */
export default function JiraOAuthRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const path = location.pathname.replace(/\/$/, "") || "/";
    if (path === "/app/settings/integrations/jira") {
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

    navigate(`/app/settings/integrations/jira${location.search}`, { replace: true });
  }, [location.pathname, location.search, navigate]);

  return null;
}
