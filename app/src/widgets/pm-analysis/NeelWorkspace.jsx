import { useEffect, useState } from "react";
import { NEEL_NAME, PM_STAGE_LABELS } from "../../entities/pm-agents";
import { Panel, PanelHeader } from "../../shared/ui/Panel";
import { NeelStatusBadge, NeelTicketTypeBadge } from "./NeelStatusBadge";
import { NeelStageStepper } from "./NeelStageStepper";
import {
  NeelCodebaseSection,
  NeelConversationPanel,
  NeelDiscoverySection,
  NeelHandoffPackageSection,
  NeelIntakeSection,
  NeelPostShipSection,
} from "./NeelSections";
import DiscoveryPrdSection from "../discovery/DiscoveryPrdSection";
import {
  PmRetrospectiveSection,
  PmTechHandoffSection,
} from "./PmAnalysisSections";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "discovery", label: "Discovery" },
  { id: "codebase", label: "Codebase" },
  { id: "prd", label: "PRD" },
  { id: "handoff", label: "Handoff" },
];

function NeelHero({ analysis }) {
  const ticket = analysis?.ticketInput;
  const needsYou =
    analysis?.status === "AWAITING_INPUT" || analysis?.status === "AWAITING_CONFIRMATION";

  return (
    <div
      className={`rounded-app border px-5 py-5 sm:px-6 ${
        needsYou
          ? "border-warning/30 bg-gradient-to-br from-warning/5 via-app-surface to-indigo/5"
          : "border-app-border bg-app-surface shadow-app-card"
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-indigo/25 bg-indigo/10 font-display text-xl text-indigo"
            aria-hidden
          >
            N
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-mono text-[13px] font-semibold text-indigo">
                {analysis?.jiraKey}
              </h2>
              <NeelStatusBadge status={analysis?.status} />
              <NeelTicketTypeBadge type={analysis?.neelIntake?.ticketType} />
            </div>
            <p className="mt-1.5 text-[15px] font-medium leading-snug text-app-ink">
              {ticket?.summary ?? "Ticket analysis"}
            </p>
            {analysis?.currentStage && (
              <p className="mt-2 text-[13px] text-app-ink-dim">
                Stage: {PM_STAGE_LABELS[analysis.currentStage]}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2 text-right">
          {analysis?.costUsd != null && (
            <span className="font-mono text-[11px] text-app-ink-mute">
              ${analysis.costUsd.toFixed(3)} run cost
            </span>
          )}
        </div>
      </div>
      <div className="mt-5 lg:hidden">
        <NeelStageStepper analysis={analysis} compact />
      </div>
    </div>
  );
}

function TabBar({ active, onChange, analysis }) {
  const hasPrd = Boolean(analysis?.generatedPrd);
  const hasHandoff = Boolean(analysis?.handoffPackage);

  return (
    <div className="flex gap-1 overflow-x-auto rounded-app border border-app-border bg-app-surface-muted/40 p-1">
      {TABS.map((tab) => {
        const disabled =
          (tab.id === "prd" && !hasPrd) ||
          (tab.id === "handoff" && !hasHandoff && analysis?.status !== "COMPLETED");
        return (
          <button
            key={tab.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(tab.id)}
            className={`shrink-0 rounded-app-sm px-3.5 py-2 text-[13px] font-medium transition ${
              active === tab.id
                ? "bg-app-surface text-app-ink shadow-sm"
                : disabled
                  ? "cursor-not-allowed text-app-ink-mute/50"
                  : "text-app-ink-dim hover:text-app-ink"
            }`}
          >
            {tab.label}
            {tab.id === "prd" && hasPrd && (
              <span className="ml-1.5 inline-block size-1.5 rounded-full bg-success" />
            )}
          </button>
        );
      })}
    </div>
  );
}

function OverviewTab({ analysis, onRetrospective, retroRunning }) {
  return (
    <div className="space-y-5">
      <NeelIntakeSection intake={analysis.neelIntake} />
      {(analysis.solutioning?.humanConfirmed || analysis.status === "COMPLETED") && (
        <Panel>
          <PanelHeader kicker="Stage 4" title="Solution direction" />
          <div className="px-5 py-4 sm:px-6">
            <p className="text-[14px] font-medium text-app-ink">
              {analysis.solutioning?.problemStatement}
            </p>
            <div className="mt-4 whitespace-pre-wrap text-[14px] leading-relaxed text-app-ink-dim">
              {analysis.solutioning?.summaryMarkdown ?? analysis.solutioning?.recommendedApproach}
            </div>
            {analysis.solutioning?.explicitNonGoals?.length > 0 && (
              <div className="mt-4 rounded-app-sm border border-app-border bg-app-surface-muted/30 p-4">
                <p className="type-kicker">Out of scope</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-[13px] text-app-ink-dim">
                  {analysis.solutioning.explicitNonGoals.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Panel>
      )}
      <NeelPostShipSection postShip={analysis.postShip} />
      <PmRetrospectiveSection
        retrospective={analysis.retrospective}
        onRun={onRetrospective}
        running={retroRunning}
      />
    </div>
  );
}

export function NeelWorkspace({
  analysis,
  historyItems,
  activeKey,
  onSelectTicket,
  onAnswer,
  onConfirm,
  interactionBusy,
  onRetrospective,
  retroRunning,
  onResume,
  resuming,
  resumeStageLabel,
}) {
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    if (!analysis) return;
    if (analysis.status === "AWAITING_INPUT") setTab("discovery");
    if (analysis.status === "AWAITING_CONFIRMATION") setTab("overview");
  }, [analysis?.status, analysis?.jiraKey]);

  if (!analysis) return null;

  const showConversation =
    analysis.status === "AWAITING_INPUT" || analysis.status === "AWAITING_CONFIRMATION";

  return (
    <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
      {/* Sidebar */}
      <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
        <Panel className="hidden xl:block">
          <PanelHeader kicker="Progress" title={`${NEEL_NAME} pipeline`} />
          <div className="px-4 py-4 sm:px-5">
            <NeelStageStepper analysis={analysis} />
          </div>
        </Panel>

        {historyItems?.length > 0 && (
          <Panel>
            <PanelHeader kicker="Sessions" title="Recent" />
            <ul className="max-h-[280px] overflow-y-auto px-2 py-2">
              {historyItems.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelectTicket(item.jiraKey)}
                    className={`w-full rounded-app-sm px-3 py-2.5 text-left transition ${
                      activeKey === item.jiraKey
                        ? "bg-indigo/10 ring-1 ring-indigo/20"
                        : "hover:bg-app-surface-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11px] font-medium text-app-ink">
                        {item.jiraKey}
                      </span>
                      <NeelStatusBadge status={item.status} />
                    </div>
                    <p className="mt-1 truncate text-[11px] text-app-ink-dim">{item.summary}</p>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </aside>

      {/* Main */}
      <div className="min-w-0 space-y-5">
        <NeelHero analysis={analysis} />

        {showConversation && (
          <div className="relative">
            <div className="absolute -inset-px rounded-app bg-gradient-to-r from-warning/20 via-indigo/20 to-warning/20 opacity-60 blur-sm" />
            <div className="relative">
              <NeelConversationPanel
                analysis={analysis}
                onAnswer={onAnswer}
                onConfirm={onConfirm}
                busy={interactionBusy}
                prominent
              />
            </div>
          </div>
        )}

        {analysis.status === "FAILED" && analysis.error && (
          <Panel>
            <PanelHeader
              kicker="Error"
              title="Run failed"
              right={
                onResume ? (
                  <button
                    type="button"
                    disabled={resuming}
                    onClick={onResume}
                    className="app-btn-primary text-[12px] disabled:opacity-50"
                  >
                    {resuming ? "Resuming…" : `Resume${resumeStageLabel ? ` · ${resumeStageLabel}` : ""}`}
                  </button>
                ) : null
              }
            />
            <p className="px-5 py-4 text-[13px] text-danger sm:px-6">{analysis.error}</p>
          </Panel>
        )}

        <TabBar active={tab} onChange={setTab} analysis={analysis} />

        {tab === "overview" && (
          <OverviewTab
            analysis={analysis}
            onRetrospective={onRetrospective}
            retroRunning={retroRunning}
          />
        )}
        {tab === "discovery" && (
          <NeelDiscoverySection questionMode={analysis.questionMode} expanded />
        )}
        {tab === "codebase" && (
          <NeelCodebaseSection analysis={analysis.codebaseAnalysis} expanded />
        )}
        {tab === "prd" && analysis.generatedPrd && (
          <Panel>
            <PanelHeader kicker="Stage 5" title="Product requirements" />
            <div className="px-5 py-5 sm:px-6">
              <DiscoveryPrdSection parsed={{ generatedPrd: analysis.generatedPrd }} />
            </div>
          </Panel>
        )}
        {tab === "handoff" && (
          <div className="space-y-5">
            <NeelHandoffPackageSection handoffPackage={analysis.handoffPackage} expanded />
            <PmTechHandoffSection
              jiraKey={analysis.jiraKey}
              analysisComplete={analysis.status === "COMPLETED"}
            />
          </div>
        )}
      </div>
    </div>
  );
}
