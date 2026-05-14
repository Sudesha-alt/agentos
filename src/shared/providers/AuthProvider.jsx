import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Navigate, useLocation } from "react-router-dom";
import { authAdapter } from "../../entities/auth";
import { AuthContext, useAuth } from "./useAuth";

export function AuthProvider({ children }) {
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

  const logout = useCallback(async () => {
    await authAdapter.logout();
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      isAuthenticated: Boolean(session),
      login,
      logout,
      refresh,
    }),
    [session, loading, login, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function RequireAuth({ children }) {
  const { loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-5 text-center">
        <div>
          <p className="editorial-kicker text-ink-mute">Auth</p>
          <p className="mt-3 font-mono text-[12px] text-ink-dim">
            Restoring your workspace session...
          </p>
        </div>
      </div>
    );
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
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas px-5 text-center">
        <p className="font-mono text-[12px] text-ink-dim">Checking session…</p>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/app" replace />;
  }

  return children;
}
