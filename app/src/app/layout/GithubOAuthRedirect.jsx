import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useOrg } from "../../shared/providers/OrgRouteProvider";
import { orgPathMatches } from "../../shared/routing/orgPaths";

/**
 * GitHub App Setup URL may land on org home or legacy /app. Forward OAuth params
 * to the Git integration page so complete-install and repo selection run.
 */
export default function GithubOAuthRedirect() {
  const location = useLocation();
  const navigate = useNavigate();
  const { orgSlug, orgPath } = useOrg();

  useEffect(() => {
    const path = location.pathname.replace(/\/$/, "") || "/";
    const integrationPath = orgPath("settings", "integrations", "github");
    if (
      path === integrationPath ||
      orgPathMatches(path, orgSlug, "settings", "integrations", "github") ||
      path === "/app/settings/integrations/github" ||
      path === "/app/git" ||
      path === "/app/github"
    ) {
      return;
    }

    const params = new URLSearchParams(location.search);
    const hasGithubCallback =
      params.has("installation_id") ||
      params.get("github_error") === "invalid_state" ||
      (params.get("provider") === "github" && params.has("setup_action"));

    if (!hasGithubCallback) return;

    navigate(`${integrationPath}${location.search}`, { replace: true });
  }, [location.pathname, location.search, navigate, orgPath, orgSlug]);

  return null;
}
