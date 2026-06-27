import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { DEMO_CREDENTIAL_HINT, getGoogleAuthStartUrl, getGoogleAuthStatus } from "../entities/auth";
import MarketingGridBackground from "../marketing/agent-team/components/MarketingGridBackground";
import { useAuth } from "../shared/providers/useAuth";
import { DATA_MODE } from "../shared/config/app";
import { sessionHomePath, migrateAppPath } from "../shared/routing/orgPaths";
import "../marketing/agent-team/agentTeam.css";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, signup } = useAuth();
  const isSignup = location.state?.mode === "signup";
  const [email, setEmail] = useState(isSignup ? "" : DEMO_CREDENTIAL_HINT.email);
  const [password, setPassword] = useState(isSignup ? "" : DEMO_CREDENTIAL_HINT.password);
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(false);
  const [error, setError] = useState("");

  const destination = useMemo(() => {
    if (typeof location.state?.from === "string" && location.state.from !== "/app") {
      return location.state.from;
    }
    return "/app";
  }, [location.state]);

  useEffect(() => {
    let cancelled = false;
    void getGoogleAuthStatus().then((status) => {
      if (!cancelled) setGoogleAvailable(Boolean(status?.googleAvailable));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(event) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const session = isSignup
        ? await signup({ email, password })
        : await login({ email, password });
      if (session.onboardingCompleted === false) {
        navigate("/onboarding", { replace: true });
        return;
      }
      const slug = session.organization?.slug ?? session.user?.organizationSlug;
      const orgHome = slug ? sessionHomePath(session) : destination;
      const target =
        slug && destination.startsWith("/app")
          ? migrateAppPath(slug, destination)
          : slug &&
              (destination === `/${slug}` || destination.startsWith(`/${slug}/`))
            ? destination
            : slug
              ? orgHome
              : destination;
      navigate(target, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setPending(false);
    }
  }

  function handleGoogleSignIn() {
    setGooglePending(true);
    setError("");
    window.location.href = getGoogleAuthStartUrl(destination);
  }

  return (
    <div className="agent-team at-landing-root relative flex min-h-screen items-center justify-center px-5 py-12">
      <MarketingGridBackground />
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-50" aria-hidden>
        <div className="absolute left-[5%] top-[10%] h-56 w-72 rounded-[48px] bg-[#A8C53A]/20 blur-3xl" />
        <div className="absolute right-[10%] bottom-[15%] h-48 w-64 rounded-[48px] bg-[#D9B8E8]/25 blur-3xl" />
      </div>

      <div className="relative z-[1] w-full max-w-md">
        <div className="at-card p-8 sm:p-10">
          <Link to="/" className="flex items-center justify-center gap-2">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-[#2B2D33] font-bold text-white">
              A
            </span>
            <span className="font-[Poppins] text-xl font-semibold text-[#2B2D33]">Agentos</span>
          </Link>

          <h1 className="mt-8 text-center text-2xl font-bold text-[#2B2D33]">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-2 text-center text-[15px] text-[#6B6B6B]">
            {isSignup
              ? "Start your workspace — connect Jira and run your first pipeline."
              : "Sign in to run pipelines, manage company context, and work with Virin, Ananta, and Neel."}
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <Field id="email" label="Email" type="email" value={email} onChange={setEmail} required />
            <Field
              id="password"
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              required
            />

            {!isSignup ? (
              <div className="flex justify-end">
                <Link
                  to="/forgot-password"
                  className="text-[12px] font-medium text-[#6B6B6B] hover:text-[#2B2D33] hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
            ) : null}

            {error ? (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={pending || googlePending}
              className="at-btn-charcoal w-full py-3.5 text-[15px] font-semibold disabled:opacity-50"
            >
              {pending ? "Please wait…" : isSignup ? "Create Account" : "Log In"}
            </button>
          </form>

          {googleAvailable ? (
            <>
              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-[#E8E4DE]" />
                <span className="text-[12px] font-medium uppercase tracking-wide text-[#6B6B6B]">
                  or
                </span>
                <div className="h-px flex-1 bg-[#E8E4DE]" />
              </div>
              <button
                type="button"
                disabled={pending || googlePending}
                onClick={handleGoogleSignIn}
                className="flex w-full items-center justify-center gap-3 rounded-2xl border border-[#E8E4DE] bg-white px-4 py-3.5 text-[15px] font-semibold text-[#2B2D33] transition hover:border-[#2B2D33]/20 disabled:opacity-50"
              >
                <GoogleMark />
                {googlePending ? "Redirecting to Google…" : "Continue with Google"}
              </button>
            </>
          ) : null}

          <div className="mt-6 text-center text-[13px] text-[#6B6B6B]">
            {isSignup ? (
              <>
                Already have an account?{" "}
                <Link to="/login" className="font-medium text-[#2B2D33] hover:text-[#A8C53A] hover:underline">
                  Sign in
                </Link>
              </>
            ) : (
              <>
                New to Agentos?{" "}
                <Link
                  to="/login"
                  state={{ mode: "signup" }}
                  className="font-medium text-[#2B2D33] hover:text-[#A8C53A] hover:underline"
                >
                  Create an account
                </Link>
              </>
            )}
          </div>

          {DATA_MODE === "mock" && (
            <p className="mt-6 rounded-2xl bg-[#F0EEEB] px-4 py-3 text-center text-[12px] text-[#6B6B6B]">
              Demo: any email works in mock mode. Try {DEMO_CREDENTIAL_HINT.email}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ id, label, value, onChange, type, required }) {
  return (
    <label className="block" htmlFor={id}>
      <span className="text-[12px] font-semibold uppercase tracking-wide text-[#6B6B6B]">
        {label}
      </span>
      <input
        id={id}
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full rounded-2xl border border-[#E8E4DE] bg-[#FAF7F0]/50 px-4 py-3 text-[15px] text-[#2B2D33]"
      />
    </label>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303C33.654 32.657 29.083 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C33.64 6.053 28.991 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 16.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C33.64 6.053 28.991 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.219 8-11.303 8-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44c7.682 0 14.344-4.337 17.694-10.691z"
      />
    </svg>
  );
}
