import { createContext, useCallback, useContext, useMemo } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { useAuth } from "./useAuth";
import { isReservedSlug, orgPath, orgRelativePath } from "../routing/orgPaths";

const OrgContext = createContext(null);

export function OrgRouteProvider({ children }) {
  const { organization, hasOrganization } = useAuth();
  const { orgSlug: paramSlug } = useParams();
  const location = useLocation();

  const sessionSlug = organization?.slug ?? null;

  if (!hasOrganization || !sessionSlug) {
    return <Navigate to="/onboarding" replace />;
  }

  if (isReservedSlug(paramSlug) || paramSlug !== sessionSlug) {
    const relative = paramSlug && !isReservedSlug(paramSlug)
      ? orgRelativePath(location.pathname, paramSlug)
      : orgRelativePath(location.pathname.replace(/^\/app/, `/${sessionSlug}`), sessionSlug);
    const suffix = relative.replace(/^\//, "");
    const target = suffix
      ? orgPath(sessionSlug, suffix) + location.search + location.hash
      : orgPath(sessionSlug) + location.search + location.hash;
    return <Navigate to={target} replace />;
  }

  const value = useMemo(
    () => ({
      orgSlug: sessionSlug,
      orgPath: (...segments) => orgPath(sessionSlug, ...segments),
    }),
    [sessionSlug]
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) {
    throw new Error("useOrg must be used within OrgRouteProvider");
  }
  return ctx;
}

/** Safe variant for layout components that may render outside org shell. */
export function useOrgOptional() {
  return useContext(OrgContext);
}

export function useOrgPathBuilder() {
  const { organization } = useAuth();
  const slug = organization?.slug;
  return useCallback(
    (...segments) => {
      if (!slug) return `/app/${segments.filter(Boolean).join("/")}`.replace(/\/$/, "") || "/app";
      return orgPath(slug, ...segments);
    },
    [slug]
  );
}
