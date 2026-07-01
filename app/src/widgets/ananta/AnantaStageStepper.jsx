const STATUS_STYLES = {
  done: {
    dot: "border-success/50 bg-success/15 text-success",
    line: "bg-success/50",
    label: "text-app-ink",
  },
  active: {
    dot: "border-indigo bg-indigo text-white shadow-[0_0_0_3px_rgba(99,102,241,0.2)]",
    line: "bg-app-border",
    label: "text-indigo font-medium",
  },
  failed: {
    dot: "border-danger bg-danger/15 text-danger",
    line: "bg-danger/30",
    label: "text-danger font-medium",
  },
  pending: {
    dot: "border-app-border bg-app-surface text-app-ink-mute",
    line: "bg-app-border",
    label: "text-app-ink-dim",
  },
};

function statusIcon(status) {
  if (status === "done") return "✓";
  if (status === "failed") return "!";
  if (status === "active") return "●";
  return String.fromCharCode(160);
}

export default function AnantaStageStepper({ stages, compact = false }) {
  const items = stages ?? [];
  if (!items.length) return null;

  if (compact) {
    const doneCount = items.filter((s) => s.status === "done").length;
    const active = items.find((s) => s.status === "active");
    const pct = Math.round(
      ((doneCount + (active ? 0.5 : 0)) / Math.max(items.length, 1)) * 100
    );
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="type-kicker">{active?.label ?? "Engineering pipeline"}</span>
          <span className="font-mono text-app-ink-mute">{pct}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-app-surface-muted">
          <div
            className="h-full rounded-full bg-indigo transition-all duration-500"
            style={{ width: `${Math.max(pct, 8)}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((stage, index) => {
        const style = STATUS_STYLES[stage.status] ?? STATUS_STYLES.pending;
        const isLast = index === items.length - 1;
        return (
          <li key={stage.id} className="relative flex min-w-0 items-start gap-3">
            {!isLast ? (
              <span
                className={`absolute left-[11px] top-7 hidden h-px w-[calc(100%+0.75rem)] lg:block ${style.line}`}
                aria-hidden
              />
            ) : null}
            <span
              className={`relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${style.dot} ${stage.status === "active" ? "animate-pulse" : ""}`}
            >
              {statusIcon(stage.status)}
            </span>
            <div className="min-w-0 pt-0.5">
              <p className={`text-[13px] ${style.label}`}>{stage.label}</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wider text-app-ink-mute">
                {stage.status === "done"
                  ? "Complete"
                  : stage.status === "active"
                    ? "In progress"
                    : stage.status === "failed"
                      ? "Failed"
                      : "Pending"}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
