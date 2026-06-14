const STATUS_STYLES = {
  RUNNING: "border-indigo/40 bg-indigo/10 text-indigo",
  COMPLETED: "border-success/40 bg-success/10 text-success",
  FAILED: "border-danger/40 bg-danger/10 text-danger",
  AWAITING_INPUT: "border-warning/40 bg-warning/10 text-warning",
  AWAITING_CONFIRMATION: "border-amber-500/40 bg-amber-500/10 text-amber-700",
};

const STATUS_LABELS = {
  RUNNING: "Working",
  COMPLETED: "Complete",
  FAILED: "Failed",
  AWAITING_INPUT: "Your turn",
  AWAITING_CONFIRMATION: "Confirm direction",
};

export function VirinStatusBadge({ status }) {
  const key = status ?? "RUNNING";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] ${
        STATUS_STYLES[key] ?? STATUS_STYLES.RUNNING
      }`}
    >
      {(key === "RUNNING" || key === "AWAITING_INPUT") && (
        <span className="size-1.5 animate-pulse rounded-full bg-current" />
      )}
      {STATUS_LABELS[key] ?? key}
    </span>
  );
}

export function VirinTicketTypeBadge({ type }) {
  if (!type) return null;
  const label = String(type).replace(/_/g, " ");
  return (
    <span className="rounded-full border border-app-border bg-app-surface-muted/60 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wide text-app-ink-dim">
      {label}
    </span>
  );
}
