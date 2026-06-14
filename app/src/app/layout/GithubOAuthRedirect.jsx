import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

/**
 * GitHub App Setup URL often points at /app/ (dashboard). Forward OAuth params
 * to the Git integration page so complete-install and repo selection run.
 */
export default function GithubOAuthRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const path = location.pathname.replace(/\/$/, "") || "/";
    if (
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

    navigate(`/app/settings/integrations/github${location.search}`, { replace: true });
  }, [location.pathname, location.search, navigate]);

  return null;
}
