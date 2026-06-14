import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useCompanyProfile } from "../../entities/company-intelligence";
import { AGENT_NAMES } from "../../shared/config/app";
import {
  analyzePmTicket,
  answerVirinQuestion,
  confirmVirinDirection,
  exportProductPackage,
  getPmResumeStage,
  PM_STAGE_LABELS,
  PM_STAGE_ORDER,
  resumePmAnalysis,
  runPmRetrospective,
  usePmAnalysis,
  usePmAnalyses,
  VIRIN_NAME,
} from "../../entities/pm-agents";
import { useJiraSyncIssues } from "../../entities/jira-sync";
import { usePipelineIntakeTickets } from "../../entities/pipeline-jira";
import { VirinWorkspace } from "../../widgets/pm-analysis/VirinWorkspace";
import { VirinStageStepper } from "../../widgets/pm-analysis/VirinStageStepper";
import { AgentPageWithChat } from "../../widgets/agent-chat/AgentPageWithChat";
import { PageIntro, Panel, PanelHeader } from "../../shared/ui/Panel";
import { AnimatedAppPage } from "../../shared/ui/AnimatedAppPage";
import Spinner from "../components/Spinner";

const PRINCIPLES = [
  "One question at a time",
  "Confirm before PRD",
  "Codebase-informed ACs",
  "Simplest version first",
];

export default function PmAgents() {
  const [searchParams] = useSearchParams();
  const ticketFromUrl = searchParams.get("ticket")?.trim().toUpperCase() || "";
  const [ticketInput, setTicketInput] = useState(ticketFromUrl || "PLT-1287");
  const [activeKey, setActiveKey] = useState(ticketFromUrl || "PLT-1287");
  const [analyzing, setAnalyzing] = useState(false);
  const [retroRunning, setRetroRunning] = useState(false);
  const [interactionBusy, setInteractionBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const [error, setError] = useState(null);

  const { data: companyProfile } = useCompanyProfile();
  const { data: listData, refetch: refetchList } = usePmAnalyses();
  const companyConfigured =
    Boolean(companyProfile?.businessContext?.trim()) ||
    Boolean(companyProfile?.companyName?.trim() && companyProfile?.revenueModel?.trim());
  const { data: analysis, refetch: refetchAnalysis } = usePmAnalysis(activeKey, {
    pollMs: analyzing ? 2500 : 0,
  });
  const { data: intake } = usePipelineIntakeTickets(true, { pollMs: 30000 });
  const { data: syncedIssues } = useJiraSyncIssues({ limit: 20 });

  const intakeTickets = intake?.items ?? [];
  const syncedTickets = syncedIssues?.items ?? [];

  const isRunning =
    analysis?.status === "RUNNING" ||
    analyzing ||
    analysis?.status === "AWAITING_INPUT" ||
    analysis?.status === "AWAITING_CONFIRMATION";

  const needsAttention =
    analysis?.status === "AWAITING_INPUT" || analysis?.status === "AWAITING_CONFIRMATION";

  useEffect(() => {
    if (ticketFromUrl) {
      setTicketInput(ticketFromUrl);
      setActiveKey(ticketFromUrl);
    }
  }, [ticketFromUrl]);

  useEffect(() => {
    if (
      analysis?.status === "RUNNING" ||
      analysis?.status === "AWAITING_INPUT" ||
      analysis?.status === "AWAITING_CONFIRMATION"
    ) {
      setAnalyzing(true);
    }
    if (analysis?.status === "COMPLETED" || analysis?.status === "FAILED") {
      setAnalyzing(false);
    }
  }, [analysis?.status]);

  async function handleAnalyze() {
    const key = ticketInput.trim().toUpperCase();
    if (!key) return;
    setError(null);
    setAnalyzing(true);
    setActiveKey(key);
    try {
      await analyzePmTicket(key);
      await refetchAnalysis();
      await refetchList();
    } catch (err) {
      setError(err.message ?? "Analysis failed");
      setAnalyzing(false);
    }
  }

  async function handleResume() {
    const key = activeKey?.trim().toUpperCase();
    if (!key) return;
    const resumeFrom = getPmResumeStage(analysis);
    if (!resumeFrom) {
      setError("No failed stage to resume from.");
      return;
    }
    setError(null);
    setAnalyzing(true);
    try {
      await resumePmAnalysis(key, { resumeFrom });
      await refetchAnalysis();
      await refetchList();
    } catch (err) {
      setError(err.message ?? "Resume failed");
      setAnalyzing(false);
    }
  }

  async function handleAnswer(answer) {
    setInteractionBusy(true);
    setError(null);
    try {
      await answerVirinQuestion(activeKey, answer);
      setAnalyzing(true);
      await refetchAnalysis();
    } catch (err) {
      setError(err.message ?? "Failed to send answer");
    } finally {
      setInteractionBusy(false);
    }
  }

  async function handleConfirm(body) {
    setInteractionBusy(true);
    setError(null);
    try {
      await confirmVirinDirection(activeKey, body);
      setAnalyzing(true);
      await refetchAnalysis();
    } catch (err) {
      setError(err.message ?? "Failed to confirm direction");
    } finally {
      setInteractionBusy(false);
    }
  }

  async function handleExportPackage() {
    setExportBusy(true);
    setError(null);
    try {
      const pkg = await exportProductPackage(activeKey);
      const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${activeKey}-product-package.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message ?? "Export failed");
    } finally {
      setExportBusy(false);
    }
  }

  async function handleRetrospective() {
    setRetroRunning(true);
    setError(null);
    try {
      await runPmRetrospective(activeKey, {});
      await refetchAnalysis();
    } catch (err) {
      setError(err.message ?? "Retrospective failed");
    } finally {
      setRetroRunning(false);
    }
  }

  function selectFromList(key) {
    setActiveKey(key);
    setTicketInput(key);
  }

  const showEmptyLoader =
    isRunning && analysis?.status === "RUNNING" && !analysis?.neelIntake && !needsAttention;

  return (
    <AnimatedAppPage wide>
      <AgentPageWithChat domain="virin" contextKey={activeKey ?? ""}>
      <header className="grid gap-4 pb-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <PageIntro
          kicker="Product"
          title={AGENT_NAMES.VIRIN}
          body="Conversational discovery that classifies tickets, asks one question at a time, pressure-tests against your codebase, and writes a PRD only after you confirm the direction."
        />
        <ul className="flex flex-wrap gap-2 lg:justify-end">
          {PRINCIPLES.map((p) => (
            <li
              key={p}
              className="rounded-full border border-app-border bg-app-surface-muted/50 px-3 py-1 text-[11px] text-app-ink-dim"
            >
              {p}
            </li>
          ))}
        </ul>
      </header>

      {!companyConfigured && (
        <Panel className="border-warning/30 bg-warning/5">
          <PanelHeader
            kicker="Setup"
            title="Configure company profile first"
            body={`${AGENT_NAMES.VIRIN} validates every idea against your business context and revenue model. Add company details so discovery and PRD stages can judge fit.`}
            right={
              <Link
                to="/app/settings/company"
                className="rounded-full border border-indigo/30 bg-indigo/10 px-4 py-2 text-[12px] font-medium text-indigo hover:bg-indigo/15"
              >
                Set up company profile →
              </Link>
            }
          />
        </Panel>
      )}

      {/* Ticket launcher */}
      <Panel>
        <PanelHeader
          kicker="New session"
          title="Start with a Jira ticket"
          body="Pick from synced issues or enter a key manually."
        />
        <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-end sm:px-6">
          <label className="min-w-0 flex-1">
            <span className="type-kicker">Jira key</span>
            <input
              type="text"
              value={ticketInput}
              onChange={(e) => setTicketInput(e.target.value.toUpperCase())}
              placeholder="PLT-1287"
              className="mt-1.5 w-full rounded-app-sm border border-app-border bg-app-surface px-4 py-2.5 font-mono text-sm text-app-ink outline-none transition focus:border-indigo/40 focus:ring-2 focus:ring-indigo/10"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isRunning) handleAnalyze();
              }}
            />
          </label>
          <button
            type="button"
            disabled={isRunning || !ticketInput.trim()}
            onClick={handleAnalyze}
            className="app-btn-primary shrink-0 disabled:opacity-50"
          >
            {isRunning && !needsAttention
              ? `${VIRIN_NAME} is working…`
              : needsAttention
                ? "Session in progress"
                : `Analyze with ${VIRIN_NAME}`}
          </button>
        </div>

        {(syncedTickets.length > 0 || intakeTickets.length > 0) && (
          <div className="border-t border-app-border px-5 py-4 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-2">
              {intakeTickets.length > 0 && (
                <div>
                  <p className="type-kicker text-indigo">AI Worker queue</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {intakeTickets.slice(0, 6).map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => selectFromList(t.key)}
                        className="rounded-full border border-indigo/30 bg-indigo/10 px-3 py-1 font-mono text-[12px] text-indigo transition hover:bg-indigo/15"
                      >
                        {t.key}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {syncedTickets.length > 0 && (
                <div>
                  <p className="type-kicker">Synced from Jira</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {syncedTickets.slice(0, 8).map((t) => (
                      <button
                        key={t.jiraKey}
                        type="button"
                        onClick={() => selectFromList(t.jiraKey)}
                        title={t.summary}
                        className="rounded-full border border-app-border px-3 py-1 font-mono text-[12px] text-app-ink-dim transition hover:border-indigo/30 hover:text-indigo"
                      >
                        {t.jiraKey}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <p className="border-t border-danger/20 bg-danger/5 px-5 py-3 text-[13px] text-danger sm:px-6">
            {error}
          </p>
        )}
      </Panel>

      {showEmptyLoader && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-app border border-dashed border-app-border py-16">
          <Spinner />
          <div className="text-center">
            <p className="text-sm font-medium text-app-ink">{VIRIN_NAME} is reading the ticket</p>
            <p className="mt-1 text-[13px] text-app-ink-dim">Stage 1 — intake & classification</p>
          </div>
          <div className="w-full max-w-xs px-6">
            <VirinStageStepper analysis={analysis} compact />
          </div>
        </div>
      )}

      {analysis && !showEmptyLoader && (
        <VirinWorkspace
          analysis={analysis}
          historyItems={listData?.items}
          activeKey={activeKey}
          onSelectTicket={selectFromList}
          onAnswer={handleAnswer}
          onConfirm={handleConfirm}
          interactionBusy={interactionBusy}
          onRetrospective={handleRetrospective}
          retroRunning={retroRunning}
          onResume={analysis.status === "FAILED" ? handleResume : undefined}
          resuming={analyzing}
          onExportPackage={handleExportPackage}
          exportBusy={exportBusy}
          resumeStageLabel={
            analysis.status === "FAILED"
              ? PM_STAGE_LABELS[getPmResumeStage(analysis)] ?? null
              : null
          }
        />
      )}

      {!analysis && !showEmptyLoader && (
        <div className="rounded-app border border-dashed border-app-border px-6 py-20 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-indigo/10 font-display text-2xl text-indigo">
            V
          </div>
          <p className="mt-4 text-[15px] font-medium text-app-ink">
            No active session
          </p>
          <p className="mx-auto mt-2 max-w-md text-[14px] text-app-ink-dim">
            Enter a Jira key above to start. {VIRIN_NAME} will classify the ticket, ask discovery
            questions one at a time, analyze your codebase, and produce a PRD with engineering
            tickets.
          </p>
          <ol className="mx-auto mt-8 grid max-w-lg gap-2 text-left sm:grid-cols-2">
            {PM_STAGE_ORDER.map((stage, i) => (
              <li
                key={stage}
                className="flex items-center gap-2 rounded-app-sm border border-app-border/80 bg-app-surface-muted/30 px-3 py-2 text-[12px] text-app-ink-dim"
              >
                <span className="font-mono text-[10px] text-indigo">{i + 1}</span>
                {PM_STAGE_LABELS[stage]}
              </li>
            ))}
          </ol>
        </div>
      )}
      </AgentPageWithChat>
    </AnimatedAppPage>
  );
}
