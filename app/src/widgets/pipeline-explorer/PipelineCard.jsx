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
      className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
        selected
          ? "border-indigo/50 bg-indigo/5 shadow-[inset_0_0_0_1px_rgba(99,102,241,0.2)]"
          : "border-hairline bg-surface/25 hover:border-hairline-strong hover:bg-surface/40"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-mono text-[11px] text-indigo">{pipeline.jiraKey}</p>
            {isPm ? (
              <span className="rounded-full border border-indigo/25 bg-indigo/10 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-indigo">
                PM
              </span>
            ) : null}
          </div>
          <p className="mt-1 truncate text-[13px] text-ink">{pipeline.summary}</p>
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
        ) : (
          <StageRail
            currentStage={pipeline.currentStage}
            status={pipeline.status}
            compact
          />
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 font-mono text-[10.5px] text-ink-mute">
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
