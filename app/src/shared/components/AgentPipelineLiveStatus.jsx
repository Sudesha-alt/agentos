import { Link } from "react-router-dom";
import { usePipelineLive } from "../../entities/pipeline";
import StageRail from "./StageRail";
import StatusPill from "../../app/components/StatusPill";
import { PipelineBlockingAlert } from "../../widgets/pm-analysis/VirinThoughtProcessPanel";
import { formatRelativeTime } from "../lib/format";
import { pipelineMatchesAgentStage } from "../lib/agentPipelineStages";
import { useOrgPathBuilder } from "../providers/OrgRouteProvider";
import { Panel, PanelHeader } from "../ui/Panel";

function stageTone(status) {
  if (status === "COMPLETED") return "bg-success";
  if (status === "RUNNING") return "bg-indigo animate-pulse";
  if (status === "AWAITING_HUMAN" || status === "PAUSED") return "bg-warning";
  if (status === "FAILED") return "bg-danger";
  return "bg-app-border";
}

/**
 * Live pipeline progress for a specific agent workspace (Virin / Ananta / Neel).
 */
export default function AgentPipelineLiveStatus({ agentKey, className = "" }) {
  const orgPath = useOrgPathBuilder();
  const { active } = usePipelineLive({ pollMs: 3000 });

  if (!active || !pipelineMatchesAgentStage(active.currentStage, agentKey)) {
    return null;
  }

  const isPaused = active.status === "PAUSED";

  return (
    <Panel className={`border-indigo/25 bg-indigo/[0.03] ${className}`}>
      <PanelHeader
        kicker={isPaused ? "Needs review" : "Live pipeline"}
        title={
          isPaused
            ? `${active.jiraKey} paused at ${active.currentStageLabel}`
            : `${active.jiraKey} — ${active.currentStageLabel}`
        }
        right={<StatusPill status={active.status} />}
      />

      <div className="space-y-4 px-5 py-4 sm:px-6">
        <PipelineBlockingAlert live={isPaused ? active : null} />

        <p className="text-sm text-app-ink">{active.summary}</p>

        <div>
          <p className="text-[13px] leading-relaxed text-app-ink-dim">
            <span className="font-medium text-app-ink">Now:</span> {active.currentAction}
          </p>
          <div className="mt-3">
            <StageRail
              currentStage={active.currentStage}
              status={active.status}
              compact
            />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-app-ink-mute">
              Stage progress
            </p>
            <ul className="mt-2 space-y-1.5">
              {active.stageProgress
                .filter((step) => pipelineMatchesAgentStage(step.stage, agentKey))
                .map((step) => (
                  <li
                    key={step.stage}
                    className="flex items-center gap-2 text-[12px] text-app-ink-dim"
                  >
                    <span className={`size-2 shrink-0 rounded-full ${stageTone(step.status)}`} />
                    <span
                      className={
                        step.stage === active.currentStage ? "font-medium text-app-ink" : ""
                      }
                    >
                      {step.label}
                    </span>
                  </li>
                ))}
            </ul>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-app-ink-mute">
              Activity
            </p>
            {active.recentActivity.length === 0 ? (
              <p className="mt-2 text-[13px] text-app-ink-dim">Starting…</p>
            ) : (
              <ol className="mt-2 max-h-44 space-y-2 overflow-y-auto pr-1">
                {active.recentActivity.slice(0, 8).map((entry) => (
                  <li
                    key={entry.id}
                    className="rounded-app-sm border border-app-border/80 bg-app-surface/60 px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] text-app-ink">{entry.label}</p>
                      <span className="shrink-0 text-[10px] text-app-ink-mute">
                        {formatRelativeTime(entry.timestamp)}
                      </span>
                    </div>
                    {entry.detail ? (
                      <p className="mt-1 text-[12px] leading-relaxed text-app-ink-dim">
                        {entry.detail}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        <Link
          to={orgPath("pipelines", active.pipelineId)}
          className="inline-flex text-[12px] font-medium text-indigo hover:underline"
        >
          Open full pipeline details →
        </Link>
      </div>
    </Panel>
  );
}
