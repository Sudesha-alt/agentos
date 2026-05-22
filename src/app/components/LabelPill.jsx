const TONES = {
  success: "border-success/30 text-success",
  warning: "border-warning/30 text-warning",
  danger: "border-danger/30 text-danger",
  muted: "border-hairline text-ink-dim",
  indigo: "border-indigo/30 text-indigo",
};

export default function LabelPill({ label, tone = "muted", className = "" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ${TONES[tone] ?? TONES.muted} ${className}`}
    >
      {label}
    </span>
  );
}
