import { AGENT_NAMES } from "../../shared/config/app";
import StatusPill from "../../app/components/StatusPill";
import StageRail from "../../shared/components/StageRail";
import PmStageRail from "../pm-analysis/PmStageRail";
import { formatRelativeTime, formatUsd } from "../../shared/lib/format";

export default function PipelineCard({
  pipeline,
  selected,
  onSelect,
  showAction = false,
}) {
  const isPm = pipeline.kind === "pm";
  const cost = isPm
    ? pipeline.costUsd
    : pipeline.raw?.stages?.reduce?.((sum, s) => sum + (s.costUsd ?? 0), 0);

  return (
    <button
      type="button"
      onClick={() => onSelect(pipeline.id)}
      className={`w-full rounded-app-sm border px-3.5 py-2.5 text-left transition-all duration-200 ${
        selected
          ? "border-indigo/35 bg-app-lavender/50 shadow-app-nav-active"
          : "border-app-border bg-app-surface hover:border-app-ink/10 hover:shadow-app-card"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-mono text-[11px] text-indigo">{pipeline.jiraKey}</p>
            {isPm ? (
              <span className="rounded-full border border-indigo/25 bg-indigo/10 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-indigo">
                {AGENT_NAMES.VIRIN}
              </span>
            ) : null}
          </div>
          <p className="mt-1 truncate text-sm text-app-ink">{pipeline.summary}</p>
        </div>
        <StatusPill status={pipeline.status} />
      </div>

      <div className="mt-3">
        {isPm ? (
          <PmStageRail
            currentStage={pipeline.currentStage}
            status={pipeline.status}
            compact
          />
        ) : pipeline.kind === "queued" ? (
          <p className="text-[11px] text-app-ink-mute">Waiting in pipeline queue…</p>
        ) : (
          <StageRail
            currentStage={pipeline.currentStage}
            status={pipeline.status}
            compact
          />
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-app-ink-mute">
        <span>{formatRelativeTime(pipeline.startedAt)}</span>
        {typeof cost === "number" && cost > 0 ? (
          <span>{formatUsd(cost)}</span>
        ) : null}
        {showAction && pipeline.status === "PAUSED" ? (
          <span className="rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-warning">
            Review required
          </span>
        ) : null}
      </div>
    </button>
  );
}
