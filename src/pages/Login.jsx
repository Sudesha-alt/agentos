import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import Logo from "../components/Logo";
import { DEMO_CREDENTIAL_HINT } from "../entities/auth";
import { useAuth } from "../shared/providers/useAuth";
import { Panel, PanelHeader } from "../shared/ui/Panel";
import { DATA_MODE } from "../shared/config/app";
import { EASE } from "../lib/motion";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState(DEMO_CREDENTIAL_HINT.email);
  const [password, setPassword] = useState(DEMO_CREDENTIAL_HINT.password);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const destination = useMemo(() => {
    return typeof location.state?.from === "string" ? location.state.from : "/app";
  }, [location.state]);

  async function onSubmit(event) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      await login({ email, password });
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-canvas text-ink">
      <div className="grid-bg-fine absolute inset-0 opacity-20 pointer-events-none" />
      <div className="editorial-noise absolute inset-0 opacity-[0.18] pointer-events-none" />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 size-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo/10 blur-[120px]"
      />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-5 py-6 sm:px-8">
        <div className="flex items-center justify-between">
          <Logo href="/" />
          <Link
            to="/"
            className="editorial-kicker text-ink-mute transition-colors hover:text-ink"
          >
            ← Back to site
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="grid w-full max-w-5xl gap-10 lg:grid-cols-[1fr_minmax(24rem,30rem)] lg:items-center">
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: EASE }}
              className="max-w-2xl"
            >
              <p className="editorial-kicker text-ink-mute">Workspace access</p>
              <h1 className="mt-4 max-w-[12ch] font-display text-[3.25rem] leading-[0.92] tracking-[-0.04em] text-ink sm:text-[4.75rem]">
                Sign in to your dashboard.
              </h1>
              <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-ink-dim sm:text-[16px]">
                Use your email and password to enter the orchestration workspace.
                After sign-in, you&apos;ll land directly in the user dashboard.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                <Fact
                  label="Default destination"
                  value="User dashboard"
                  note="Authenticated users are redirected into `/app`."
                />
                <Fact
                  label="Mode"
                  value={DATA_MODE === "mock" ? "Mock auth" : "REST auth"}
                  note={
                    DATA_MODE === "mock"
                      ? "Any valid email and password with at least 8 characters will work locally."
                      : "Uses backend auth endpoints when available."
                  }
                />
              </div>
            </motion.section>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE, delay: 0.05 }}
            >
              <Panel className="overflow-hidden">
                <PanelHeader
                  kicker="Sign in"
                  title="Email and password"
                  body="Authenticate to continue into the protected product workspace."
                />

                <form onSubmit={onSubmit} className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
                  <Field
                    id="email"
                    label="Email"
                    type="email"
                    value={email}
                    placeholder={DEMO_CREDENTIAL_HINT.email}
                    onChange={setEmail}
                  />
                  <Field
                    id="password"
                    label="Password"
                    type="password"
                    value={password}
                    placeholder={DEMO_CREDENTIAL_HINT.password}
                    onChange={setPassword}
                  />

                  {error ? (
                    <div className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 font-mono text-[12px] text-danger">
                      {error}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={pending}
                    className="btn-trace inline-flex w-full items-center justify-center gap-2 rounded-full border border-indigo/50 bg-indigo/15 px-5 py-3 text-[13px] text-ink transition-all hover:shadow-glow-indigo disabled:opacity-50"
                  >
                    {pending ? "Signing in…" : "Sign in"}
                  </button>

                  <div className="rounded-[1rem] border border-hairline bg-canvas/30 px-4 py-3">
                    <p className="editorial-kicker text-ink-mute">Demo</p>
                    <p className="mt-2 text-[13px] leading-relaxed text-ink-dim">
                      Local mode hint: try <span className="font-mono text-ink">{DEMO_CREDENTIAL_HINT.email}</span> /{" "}
                      <span className="font-mono text-ink">{DEMO_CREDENTIAL_HINT.password}</span>.
                    </p>
                  </div>
                </form>
              </Panel>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ id, label, value, onChange, type, placeholder }) {
  return (
    <label className="block" htmlFor={id}>
      <span className="editorial-kicker text-ink-mute">{label}</span>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-2 h-12 w-full rounded-full border border-hairline bg-surface/40 px-4 text-[14px] text-ink outline-none placeholder:text-ink-mute focus:border-indigo/50"
      />
    </label>
  );
}

function Fact({ label, value, note }) {
  return (
    <div className="rounded-[1.2rem] border border-hairline bg-surface/35 px-4 py-4">
      <p className="editorial-kicker text-ink-mute">{label}</p>
      <p className="mt-3 font-display text-[1.9rem] leading-none tracking-tight text-ink">
        {value}
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-dim">{note}</p>
    </div>
  );
}
