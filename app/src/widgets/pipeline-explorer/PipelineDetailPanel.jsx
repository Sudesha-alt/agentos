import { Link } from "react-router-dom";
import { useMemo } from "react";
import { usePipelineDetail } from "../../entities/pipeline";
import { usePipelineAudit } from "../../entities/audit";
import Spinner from "../../app/components/Spinner";
import StatusPill from "../../app/components/StatusPill";
import StageRail from "../../shared/components/StageRail";
import StageTimeline from "../../app/components/StageTimeline";
import TicketActivityWidget from "../ticket-activity/TicketActivityWidget";
import ValidationPanelWidget from "../validation-panel/ValidationPanelWidget";
import PmPipelineDetailPanel from "../pm-analysis/PmPipelineDetailPanel";
import { isPmPipelineId } from "../pm-analysis/pipelineIds";
import { Panel, PanelHeader } from "../../shared/ui/Panel";
import { formatStageLabel } from "../../shared/lib/format";

export default function PipelineDetailPanel({ pipelineId, onClose }) {
  if (isPmPipelineId(pipelineId)) {
    return <PmPipelineDetailPanel pipelineId={pipelineId} onClose={onClose} />;
  }
  return <ClassicPipelineDetailPanel pipelineId={pipelineId} onClose={onClose} />;
}

function ClassicPipelineDetailPanel({ pipelineId, onClose }) {
  const { item, loading } = usePipelineDetail(pipelineId, { pollMs: 6000 });
  const { items: auditItems } = usePipelineAudit(pipelineId, { pollMs: 9000 });

  const pausedStage = useMemo(
    () =>
      item?.stages?.find(
        (s) => s.status === "AWAITING_HUMAN" || s.status === "PAUSED"
      ),
    [item]
  );

  if (!pipelineId) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-ink-dim">
        Select a pipeline to inspect stages, discovery intelligence, and audit trail.
      </div>
    );
  }

  if (loading && !item) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner label="Loading pipeline" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="p-8 text-center text-sm text-ink-dim">Pipeline not found.</div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="shrink-0 border-b border-hairline px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] text-indigo">{item.jiraKey}</p>
            <h2 className="mt-1 font-display text-xl text-ink">{item.summary}</h2>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill status={item.status} />
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-hairline px-2 py-1 text-ink-mute hover:text-ink"
                aria-label="Close panel"
              >
                ×
              </button>
            ) : null}
          </div>
        </div>
        <div className="mt-4">
          <StageRail currentStage={item.currentStage} status={item.status} />
          <p className="mt-2 font-mono text-[10.5px] text-ink-mute">
            Current: {formatStageLabel(item.currentStage)}
          </p>
        </div>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <Panel>
          <PanelHeader kicker="Ticket" title="Summary" />
          <div className="space-y-2 px-5 py-4 text-[13px] text-ink-dim sm:px-6">
            <p>Reporter: product-team · Priority: High</p>
            <a
              href={`https://jira.example/browse/${item.jiraKey}`}
              className="text-indigo hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              Open in Jira →
            </a>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            kicker="Discovery"
            title="What we understood before acting"
            body="Requirements, ambiguities, and complexity from ticket analysis."
          />
          <div className="px-5 py-4 sm:px-6">
            <dl className="grid gap-3 sm:grid-cols-3">
              <Stat label="Requirements" value="3 atomic" />
              <Stat label="Ambiguities" value="1 flagged" />
              <Stat label="Complexity" value="6 / 10" />
            </dl>
          </div>
        </Panel>

        <details className="rounded-xl border border-hairline bg-surface/20">
          <summary className="cursor-pointer px-5 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-mute">
            Stage timeline (agent inputs & outputs)
          </summary>
          <div className="border-t border-hairline px-3 py-3">
            <StageTimeline stages={item.stages} />
          </div>
        </details>

        {item.status === "PAUSED" && pausedStage ? (
          <Panel className="border-warning/30">
            <PanelHeader
              kicker="Action required"
              title="Is this safe to continue?"
              body="Review validation failures before approving."
            />
            <div className="space-y-4 px-5 py-4 sm:px-6">
              <ValidationPanelWidget validation={pausedStage.validationResult} />
              <div className="flex flex-wrap gap-3">
                <Link
                  to={`/app/pipelines/${item.id}/override`}
                  className="btn-trace rounded-full border border-indigo/50 bg-indigo/10 px-4 py-2 text-[13px] text-ink"
                >
                  Review & override
                </Link>
                <Link
                  to={`/app/pipelines/${item.id}/prd`}
                  className="rounded-full border border-hairline px-4 py-2 text-[13px] text-ink-dim hover:text-ink"
                >
                  Open PRD viewer
                </Link>
              </div>
            </div>
          </Panel>
        ) : null}

        <Panel>
          <PanelHeader kicker="Activity" title="What happened and why" />
          <div className="px-3 py-3">
            <TicketActivityWidget
              stages={item.stages}
              auditLogs={auditItems}
              currentStage={item.currentStage}
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-ink">{value}</dd>
    </div>
  );
}
