const TONES = {
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-danger/30 bg-danger/10 text-danger",
  muted: "border-app-border bg-app-surface-muted text-app-ink-dim",
  indigo: "border-indigo/30 bg-indigo/10 text-indigo",
};

export default function LabelPill({ label, tone = "muted", className = "" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${TONES[tone] ?? TONES.muted} ${className}`}
    >
      {label}
    </span>
  );
}
