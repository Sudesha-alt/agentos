import { Link } from "react-router-dom";
import StatusPill from "../../app/components/StatusPill";
import { formatRelativeTime } from "../../shared/lib/format";
import { pipelineMatchesAgentStage } from "../../shared/lib/agentPipelineStages";
import { useOrgPathBuilder } from "../../shared/providers/OrgRouteProvider";

function stepTone(status) {
  if (status === "COMPLETED") return "bg-success";
  if (status === "RUNNING") return "bg-indigo animate-pulse";
  if (status === "BLOCKED") return "bg-warning";
  return "bg-app-border";
}

function eventTone(event) {
  if (event === "AWAITING_HUMAN") return "border-warning/40 bg-warning/5";
  if (/FAILED|BLOCK/i.test(event)) return "border-danger/30 bg-danger/5";
  if (/TOOL_CALL|CODING_TOOL|QA_TOOL/i.test(event)) return "border-indigo/25 bg-indigo/[0.04]";
  if (/LLM_RESPONSE|AGENTIC_LOOP/i.test(event)) return "border-app-border bg-app-surface/60";
  return "border-app-border/80 bg-app-surface/40";
}

/**
 * Prominent alert when a pipeline is paused / blocked for human input.
 */
export function PipelineBlockingAlert({ live, className = "" }) {
  const orgPath = useOrgPathBuilder();

  if (!live || live.status !== "PAUSED") return null;

  return (
    <div
      className={`rounded-app border border-warning/40 bg-warning/10 px-4 py-4 sm:px-5 ${className}`}
      role="alert"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-warning">
            Blocked — needs your input
          </p>
          <p className="mt-1 text-sm font-medium text-app-ink">
            {live.jiraKey} · {live.currentStageLabel}
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-app-ink-dim">
            {live.blockReason ??
              live.currentAction ??
              "The agent paused until a human reviews and unblocks this stage."}
          </p>
        </div>
        <StatusPill status="PAUSED" />
      </div>
      <div className="mt-3 flex flex-wrap gap-3">
        <Link
          to={orgPath("pipelines", live.pipelineId)}
          className="rounded-app-sm border border-warning/40 bg-app-surface px-3 py-1.5 text-[12px] font-medium text-app-ink hover:bg-warning/5"
        >
          Review in pipeline →
        </Link>
        {live.blockStage === "PRD_VALIDATION" ? (
          <Link
            to={`${orgPath("pipelines", live.pipelineId)}?tab=review`}
            className="text-[12px] font-medium text-indigo hover:underline"
          >
            Open PRD validation
          </Link>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Full thought-process timeline for the product (Virin) pipeline stage.
 * Use VirinPipelineLivePanel to poll live data, or pass `live` to VirinThoughtProcessContent.
 */
export function VirinThoughtProcessContent({ live, className = "" }) {
  const orgPath = useOrgPathBuilder();

  if (!live || !pipelineMatchesAgentStage(live.currentStage, "virin")) {
    return null;
  }

  const isPaused = live.status === "PAUSED";
  const isRunning = live.status === "RUNNING";

  return (
    <div className={`space-y-4 ${className}`}>
      <PipelineBlockingAlert live={isPaused ? live : null} />

      <div
        className={`rounded-app border px-4 py-4 sm:px-5 ${
          isPaused
            ? "border-warning/25 bg-warning/[0.03]"
            : isRunning
              ? "border-indigo/25 bg-indigo/[0.03]"
              : "border-app-border bg-app-surface"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-app-ink-mute">
              {isPaused ? "Product agent paused" : "Virin thought process"}
            </p>
            <p className="mt-1 text-sm font-medium text-app-ink">
              {live.jiraKey} — {live.summary}
            </p>
          </div>
          <StatusPill status={live.status} />
        </div>

        <p className="mt-3 text-[13px] leading-relaxed text-app-ink-dim">
          <span className="font-medium text-app-ink">Now:</span> {live.currentAction}
        </p>

        {live.discoverySteps?.length > 0 ? (
          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-app-ink-mute">
              Discovery steps
            </p>
            <ol className="mt-2 space-y-2">
              {live.discoverySteps.map((step) => (
                <li key={step.step} className="flex items-start gap-2.5 text-[13px]">
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${stepTone(step.status)}`} />
                  <span
                    className={
                      step.status === "RUNNING"
                        ? "font-medium text-app-ink"
                        : step.status === "BLOCKED"
                          ? "font-medium text-warning"
                          : "text-app-ink-dim"
                    }
                  >
                    {step.label}
                    {step.status === "BLOCKED" ? " — blocked" : null}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        <div className="mt-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-app-ink-mute">
            Activity trace
          </p>
          {(live.thoughtProcess?.length ?? live.recentActivity?.length) ? (
            <ol className="relative mt-3 max-h-[min(28rem,50vh)] space-y-0 overflow-y-auto border-l border-app-border pl-4">
              {(live.thoughtProcess ?? [...live.recentActivity].reverse()).map((entry, idx, arr) => {
                const isLatest = idx === arr.length - 1 && isRunning;
                return (
                  <li key={entry.id} className="relative pb-4 last:pb-0">
                    <span
                      className={`absolute -left-[calc(0.5rem+5px)] top-1.5 size-2.5 rounded-full border-2 border-app-surface ${
                        entry.event === "AWAITING_HUMAN"
                          ? "bg-warning"
                          : isLatest
                            ? "animate-pulse bg-indigo"
                            : "bg-app-ink-mute/40"
                      }`}
                    />
                    <div className={`rounded-app-sm border px-3 py-2.5 ${eventTone(entry.event)}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[13px] font-medium text-app-ink">{entry.label}</p>
                        <span className="shrink-0 text-[10px] text-app-ink-mute">
                          {formatRelativeTime(entry.timestamp)}
                        </span>
                      </div>
                      {entry.detail ? (
                        <p className="mt-1 text-[12px] leading-relaxed text-app-ink-dim">
                          {entry.detail}
                        </p>
                      ) : null}
                      {entry.event === "AWAITING_HUMAN" ? (
                        <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-warning">
                          Blocked until reviewed
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="mt-2 text-[13px] text-app-ink-dim">Waiting for first discovery event…</p>
          )}
        </div>

        <Link
          to={orgPath("pipelines", live.pipelineId)}
          className="mt-4 inline-flex text-[12px] font-medium text-indigo hover:underline"
        >
          Open full pipeline →
        </Link>
      </div>
    </div>
  );
}
