import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../providers/useAuth";
import { orgPath } from "./orgPaths";
import AppPageFallback from "../ui/AppPageFallback";

/** Redirect legacy /app/* bookmarks to /:orgSlug/* */
export default function AppCompatRedirect() {
  const { organization, hasOrganization, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <AppPageFallback />;

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: `${location.pathname}${location.search}${location.hash}`,
        }}
      />
    );
  }

  if (!hasOrganization || !organization?.slug) {
    return <Navigate to="/onboarding" replace />;
  }

  const suffix = location.pathname.replace(/^\/app\/?/, "");
  const target = suffix
    ? orgPath(organization.slug, suffix) + location.search + location.hash
    : orgPath(organization.slug) + location.search + location.hash;

  return <Navigate to={target} replace />;
}
