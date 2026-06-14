import { PM_STAGE_LABELS, PM_STAGE_ORDER } from "../../entities/pm-agents";

export function VirinStageStepper({ analysis, compact = false }) {
  const current = analysis?.currentStage;
  const meta = analysis?.stageMeta ?? [];
  const status = analysis?.status;

  const stageState = (stage) => {
    if (meta.some((m) => m.stage === stage && m.status === "FAILED")) return "failed";
    if (current === stage && status === "RUNNING") return "active";
    if (status === "AWAITING_INPUT" && stage === "QUESTION_MODE") return "waiting";
    if (status === "AWAITING_INPUT" && stage === "COMPETITOR_ANALYSIS") return "waiting";
    if (status === "AWAITING_CONFIRMATION" && stage === "SOLUTIONING") return "waiting";
    if (meta.some((m) => m.stage === stage && m.status === "COMPLETED")) return "done";
    return "pending";
  };

  if (compact) {
    const idx = current ? PM_STAGE_ORDER.indexOf(current) : -1;
    const doneCount = PM_STAGE_ORDER.filter((s) => stageState(s) === "done").length;
    const pct = Math.round(((doneCount + (stageState(current) === "active" ? 0.5 : 0)) / PM_STAGE_ORDER.length) * 100);
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="type-kicker">
            {current ? PM_STAGE_LABELS[current] : "Starting"}
          </span>
          <span className="font-mono text-app-ink-mute">{pct}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-app-surface-muted">
          <div
            className="h-full rounded-full bg-indigo transition-all duration-500"
            style={{ width: `${Math.max(pct, status === "COMPLETED" ? 100 : 8)}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <ol className="relative space-y-0">
      {PM_STAGE_ORDER.map((stage, i) => {
        const state = stageState(stage);
        const isLast = i === PM_STAGE_ORDER.length - 1;
        return (
          <li key={stage} className="relative flex gap-3 pb-4 last:pb-0">
            {!isLast && (
              <span
                className={`absolute left-[11px] top-6 h-[calc(100%-12px)] w-px ${
                  state === "done" ? "bg-success/50" : "bg-app-border"
                }`}
              />
            )}
            <span
              className={`relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
                state === "active"
                  ? "border-indigo bg-indigo text-white shadow-[0_0_0_3px_rgba(99,102,241,0.2)]"
                  : state === "waiting"
                    ? "border-warning bg-warning/20 text-warning"
                    : state === "done"
                      ? "border-success/50 bg-success/15 text-success"
                      : state === "failed"
                        ? "border-danger bg-danger/15 text-danger"
                        : "border-app-border bg-app-surface text-app-ink-mute"
              }`}
            >
              {state === "done" ? "✓" : i + 1}
            </span>
            <div className="min-w-0 pt-0.5">
              <p
                className={`text-[12px] font-medium leading-tight ${
                  state === "active" || state === "waiting" ? "text-app-ink" : "text-app-ink-dim"
                }`}
              >
                {PM_STAGE_LABELS[stage]}
              </p>
              <p className="mt-0.5 font-mono text-[10px] text-app-ink-mute">
                {state === "active"
                  ? "In progress"
                  : state === "waiting"
                    ? "Needs you"
                    : state === "done"
                      ? "Done"
                      : state === "failed"
                        ? "Failed"
                        : "—"}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
