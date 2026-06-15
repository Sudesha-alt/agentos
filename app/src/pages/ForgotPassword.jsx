import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useState } from "react";
import { requestPasswordReset, resetPassword } from "../entities/auth";
import "../marketing/agent-team/agentTeam.css";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    try {
      const result = await requestPasswordReset({ email });
      setMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset email.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we will send reset instructions if an account exists."
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <Field id="email" label="Email" type="email" value={email} onChange={setEmail} required />

        {error ? <ErrorBox>{error}</ErrorBox> : null}
        {message ? (
          <p className="rounded-2xl border border-[#A8C53A]/40 bg-[#A8C53A]/10 px-4 py-3 text-[13px] text-[#2B2D33]">
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="at-btn-charcoal w-full py-3.5 text-[15px] font-semibold disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send reset link"}
        </button>
      </form>

      <p className="mt-6 text-center text-[13px] text-[#6B6B6B]">
        <Link to="/login" className="font-medium text-[#2B2D33] hover:text-[#A8C53A] hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function onSubmit(event) {
    event.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const result = await resetPassword({ token, password });
      setMessage(result.message);
      setTimeout(() => navigate("/login", { replace: true }), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password.");
    } finally {
      setPending(false);
    }
  }

  if (!token) {
    return (
      <AuthShell title="Invalid link" subtitle="This reset link is missing or malformed.">
        <ErrorBox>Request a new password reset from the sign-in page.</ErrorBox>
        <Link
          to="/forgot-password"
          className="at-btn-charcoal mt-6 block w-full py-3.5 text-center text-[15px] font-semibold"
        >
          Request reset link
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle="Use at least 8 characters.">
      <form onSubmit={onSubmit} className="space-y-5">
        <Field
          id="password"
          label="New password"
          type="password"
          value={password}
          onChange={setPassword}
          required
        />
        <Field
          id="confirm"
          label="Confirm password"
          type="password"
          value={confirm}
          onChange={setConfirm}
          required
        />

        {error ? <ErrorBox>{error}</ErrorBox> : null}
        {message ? (
          <p className="rounded-2xl border border-[#A8C53A]/40 bg-[#A8C53A]/10 px-4 py-3 text-[13px] text-[#2B2D33]">
            {message}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="at-btn-charcoal w-full py-3.5 text-[15px] font-semibold disabled:opacity-50"
        >
          {pending ? "Saving…" : "Update password"}
        </button>
      </form>
    </AuthShell>
  );
}

function AuthShell({ title, subtitle, children }) {
  return (
    <div className="agent-team relative flex min-h-screen items-center justify-center px-5 py-12">
      <div className="relative w-full max-w-md">
        <div className="at-card p-8 sm:p-10">
          <Link to="/" className="flex items-center justify-center gap-2">
            <span className="flex size-10 items-center justify-center rounded-2xl bg-[#2B2D33] font-bold text-white">
              A
            </span>
            <span className="font-[Poppins] text-xl font-semibold text-[#2B2D33]">Agentos</span>
          </Link>
          <h1 className="mt-8 text-center text-2xl font-bold text-[#2B2D33]">{title}</h1>
          <p className="mt-2 text-center text-[15px] text-[#6B6B6B]">{subtitle}</p>
          <div className="mt-8">{children}</div>
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

function ErrorBox({ children }) {
  return (
    <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
      {children}
    </p>
  );
}
