import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { completeGoogleAuth } from "../entities/auth";
import { useAuth } from "../shared/providers/useAuth";
import { sessionHomePath, migrateAppPath } from "../shared/routing/orgPaths";
import Spinner from "../app/components/Spinner";
import "../marketing/agent-team/agentTeam.css";

const ERROR_MESSAGES = {
  access_denied: "Google sign-in was cancelled.",
  invalid_state: "Sign-in session expired. Please try again.",
  google_account_conflict:
    "This email is linked to a different Google account. Sign in with the original method or contact support.",
  google_auth_failed: "Google sign-in failed. Please try again.",
};

export default function GoogleAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refresh } = useAuth();
  const [error, setError] = useState("");

  const returnTo = searchParams.get("returnTo")?.trim() || "/app";
  const oauthError = searchParams.get("error");
  const handoffCode = searchParams.get("code");

  const errorMessage = useMemo(() => {
    if (!oauthError) return "";
    return ERROR_MESSAGES[oauthError] ?? `Google sign-in failed (${oauthError}).`;
  }, [oauthError]);

  useEffect(() => {
    if (oauthError) {
      setError(errorMessage);
      return;
    }
    if (!handoffCode) {
      setError("Missing Google sign-in code. Please try again.");
      return;
    }

    let cancelled = false;

    async function finish() {
      try {
        const session = await completeGoogleAuth(handoffCode);
        await refresh();

        if (cancelled) return;

        if (session.onboardingCompleted === false) {
          navigate("/onboarding", { replace: true });
          return;
        }

        const slug = session.organization?.slug ?? session.user?.organizationSlug;
        const orgHome = slug ? sessionHomePath(session) : returnTo;
        const target =
          slug && returnTo.startsWith("/app")
            ? migrateAppPath(slug, returnTo)
            : slug &&
                (returnTo === `/${slug}` || returnTo.startsWith(`/${slug}/`))
              ? returnTo
              : slug
                ? orgHome
                : returnTo;

        navigate(target, { replace: true });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Google sign-in failed.");
        }
      }
    }

    void finish();

    return () => {
      cancelled = true;
    };
  }, [handoffCode, oauthError, errorMessage, navigate, refresh, returnTo]);

  return (
    <div className="agent-team flex min-h-screen items-center justify-center bg-[#FAF7F0] px-5 py-12">
      <div className="at-card w-full max-w-md p-8 text-center sm:p-10">
        {error ? (
          <>
            <h1 className="text-xl font-bold text-[#2B2D33]">Sign-in failed</h1>
            <p className="mt-3 text-[15px] text-red-700">{error}</p>
            <Link
              to="/login"
              className="at-btn-charcoal mt-6 inline-flex px-6 py-3 text-[15px] font-semibold"
            >
              Back to login
            </Link>
          </>
        ) : (
          <>
            <Spinner label="Completing Google sign-in…" />
            <p className="mt-4 text-[15px] text-[#6B6B6B]">Finishing sign-in with Google…</p>
          </>
        )}
      </div>
    </div>
  );
}
