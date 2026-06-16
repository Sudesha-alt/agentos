import { useState } from "react";
import { Link } from "react-router-dom";
import { AGENT_NAMES } from "../../shared/config/app";
import {
  runPmRetrospective,
  usePmAnalysis,
  PM_STAGE_LABELS,
  VIRIN_NAME,
} from "../../entities/pm-agents";
import Spinner from "../../app/components/Spinner";
import StatusPill from "../../app/components/StatusPill";
import PmStageRail from "./PmStageRail";
import { jiraKeyFromPmPipelineId } from "./pipelineIds";
import { PmAnalysisOutputs } from "./PmAnalysisSections";
import { Panel, PanelHeader } from "../../shared/ui/Panel";

export default function PmPipelineDetailPanel({ pipelineId, onClose }) {
  const jiraKey = jiraKeyFromPmPipelineId(pipelineId);
  const [retroRunning, setRetroRunning] = useState(false);

  const { data: analysis, loading, refetch } = usePmAnalysis(jiraKey, {
    pollMs: 2500,
  });

  const isRunning = analysis?.status === "RUNNING";

  async function handleRetrospective() {
    setRetroRunning(true);
    try {
      await runPmRetrospective(jiraKey, {
        humanDecision: analysis?.prioritization?.recommendation,
        actualPoints: analysis?.effortEstimate?.storyPoints,
      });
      await refetch();
    } finally {
      setRetroRunning(false);
    }
  }

  if (!pipelineId) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-ink-dim">
        Select a pipeline to inspect stages and agent outputs.
      </div>
    );
  }

  if (loading && !analysis) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner label={`Loading ${VIRIN_NAME} analysis`} />
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="p-8 text-center text-sm text-ink-dim">{VIRIN_NAME} analysis not found.</div>
    );
  }

  const currentLabel = analysis.currentStage
    ? PM_STAGE_LABELS[analysis.currentStage]
    : analysis.status === "COMPLETED"
      ? "Complete"
      : "—";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="shrink-0 border-b border-hairline px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="font-mono text-[11px] text-indigo">{analysis.jiraKey}</p>
              <span className="rounded-full border border-indigo/30 bg-indigo/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-indigo">
                {AGENT_NAMES.VIRIN}
              </span>
            </div>
            <h2 className="mt-1 font-display text-xl text-ink">
              {analysis.ticketInput?.summary ?? `${VIRIN_NAME} analysis`}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <StatusPill status={analysis.status} />
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
          <PmStageRail
            currentStage={analysis.currentStage}
            status={analysis.status}
            stageMeta={analysis.stageMeta}
          />
          <p className="mt-2 font-mono text-[10.5px] text-ink-mute">
            Current: {currentLabel}
            {isRunning ? " · updating live" : ""}
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {isRunning && !analysis.enrichment && (
          <div className="mb-5 flex items-center gap-3 rounded-xl border border-indigo/30 bg-indigo/5 px-4 py-3">
            <Spinner />
            <p className="font-mono text-[12px] text-ink-dim">{VIRIN_NAME} pipeline running — outputs appear as each stage completes.</p>
          </div>
        )}

        {analysis.classification?.requiresHumanEscalation && (
          <Panel className="mb-5 border-warning/30">
            <PanelHeader
              kicker="Action required"
              title="Human escalation flagged"
              subtitle={analysis.classification.escalationReason ?? "Review classification before proceeding."}
            />
            <div className="px-5 py-3 sm:px-6">
              <Link
                to="/app/pm-agents"
                className="font-mono text-[11px] text-indigo hover:underline"
              >
                Open {AGENT_NAMES.VIRIN} →
              </Link>
            </div>
          </Panel>
        )}

        <PmAnalysisOutputs
          analysis={analysis}
          onRetrospective={analysis.status === "COMPLETED" ? handleRetrospective : undefined}
          retroRunning={retroRunning}
        />
      </div>
    </div>
  );
}
