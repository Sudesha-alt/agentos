import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { authAdapter } from "../../entities/auth";
import AppPreloader from "../ui/AppPreloader";
import { AuthContext, useAuth } from "./useAuth";
import { sessionHomePath, migrateAppPath } from "../routing/orgPaths";

export function AuthProvider({ children }) {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const next = await authAdapter.getSession();
    setSession(next);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const next = await authAdapter.getSession();
        if (!cancelled) setSession(next);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    const syncFromStorage = () => {
      void refresh();
    };

    window.addEventListener("storage", syncFromStorage);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", syncFromStorage);
    };
  }, [refresh]);

  const login = useCallback(async (payload) => {
    const next = await authAdapter.login(payload);
    setSession(next);
    return next;
  }, []);

  const signup = useCallback(async (payload) => {
    const next = await authAdapter.signup(payload);
    setSession(next);
    return next;
  }, []);

  const logout = useCallback(async () => {
    navigate("/", { replace: true });
    await authAdapter.logout();
    setSession(null);
  }, [navigate]);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      organization: session?.organization ?? null,
      loading,
      isAuthenticated: Boolean(session),
      hasOrganization: Boolean(
        session?.user?.organizationId ?? session?.organization?.id
      ),
      login,
      signup,
      logout,
      refresh,
      onboardingCompleted: session?.onboardingCompleted !== false,
    }),
    [session, loading, login, signup, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function RequireOnboardingComplete({ children }) {
  const { loading, isAuthenticated, onboardingCompleted, hasOrganization } = useAuth();
  const location = useLocation();

  if (loading) {
    return <AppPreloader overlay label="Checking session" />;
  }

  if (isAuthenticated && (!onboardingCompleted || !hasOrganization)) {
    return <Navigate to="/onboarding" replace state={{ from: location.pathname }} />;
  }

  return children;
}

export function RequireAuth({ children }) {
  const { loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return <AppPreloader overlay label="Checking session" />;
  }

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

  return children;
}

export function PublicOnlyRoute({ children }) {
  const { loading, isAuthenticated, onboardingCompleted, session } = useAuth();

  if (loading) {
    return <AppPreloader overlay label="Checking session" />;
  }

  if (isAuthenticated) {
    const target = onboardingCompleted
      ? sessionHomePath(session)
      : "/onboarding";
    return <Navigate to={target} replace />;
  }

  return children;
}
