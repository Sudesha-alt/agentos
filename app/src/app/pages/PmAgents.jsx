import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  analyzePmTicket,
  getPmResumeStage,
  PM_STAGE_LABELS,
  PM_STAGE_ORDER,
  resumePmAnalysis,
  runPmRetrospective,
  usePmAnalysis,
  usePmAnalyses,
} from "../../entities/pm-agents";
import { useJiraSyncIssues } from "../../entities/jira-sync";
import { usePipelineIntakeTickets } from "../../entities/pipeline-jira";
import { PmAnalysisOutputs } from "../../widgets/pm-analysis/PmAnalysisSections";
import { PageIntro, Panel, PanelHeader } from "../../shared/ui/Panel";
import { AnimatedAppPage } from "../../shared/ui/AnimatedAppPage";
import Spinner from "../components/Spinner";
export default function PmAgents() {
  const [searchParams] = useSearchParams();
  const ticketFromUrl = searchParams.get("ticket")?.trim().toUpperCase() || "PLT-1287";
  const [ticketInput, setTicketInput] = useState(ticketFromUrl);
  const [activeKey, setActiveKey] = useState(ticketFromUrl);
  const [analyzing, setAnalyzing] = useState(false);
  const [retroRunning, setRetroRunning] = useState(false);
  const [error, setError] = useState(null);

  const { data: listData, refetch: refetchList } = usePmAnalyses();
  const { data: analysis, refetch: refetchAnalysis } = usePmAnalysis(activeKey, {
    pollMs: analyzing ? 2500 : 0,
  });
  const { data: intake } = usePipelineIntakeTickets(true, { pollMs: 30000 });
  const { data: syncedIssues } = useJiraSyncIssues({ limit: 20 });

  const intakeTickets = intake?.items ?? [];
  const syncedTickets = syncedIssues?.items ?? [];

  const isRunning = analysis?.status === "RUNNING" || analyzing;

  useEffect(() => {
    if (ticketFromUrl) {
      setTicketInput(ticketFromUrl);
      setActiveKey(ticketFromUrl);
    }
  }, [ticketFromUrl]);

  useEffect(() => {
    if (analysis?.status === "RUNNING") {
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

  async function handleRetrospective() {
    setRetroRunning(true);
    setError(null);
    try {
      await runPmRetrospective(activeKey, {
        humanDecision: analysis?.prioritization?.recommendation,
        actualPoints: analysis?.effortEstimate?.storyPoints,
      });
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

  return (
    <AnimatedAppPage wide>
      <PageIntro
        kicker="Product operations"
        title="PM Agents"
        body="Nine-stage product intelligence pipeline — from ticket enrichment through prioritization, acceptance criteria, and stakeholder artifacts. Active runs also appear in Pipeline Explorer."
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <Panel>
          <PanelHeader kicker="Analyze" title="Ticket input" />
          <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-end sm:px-6">
            <label className="flex-1">
              <span className="type-kicker">Jira key</span>
              <input
                type="text"
                value={ticketInput}
                onChange={(e) => setTicketInput(e.target.value)}
                placeholder="PLT-1287"
                className="mt-1.5 w-full rounded-app-sm border border-app-border bg-app-surface px-3 py-2 text-sm text-app-ink outline-none focus:border-indigo/40 focus:ring-2 focus:ring-indigo/10"
              />
            </label>            <button
              type="button"
              disabled={isRunning || !ticketInput.trim()}
              onClick={handleAnalyze}
              className="app-btn-primary disabled:opacity-50"
            >
              {isRunning ? "Analyzing…" : "Analyze ticket"}
            </button>
          </div>
          {(syncedTickets.length > 0 || intakeTickets.length > 0) && (
            <div className="border-t border-hairline px-5 py-3 sm:px-6 space-y-3">
              {syncedTickets.length > 0 && (
                <div>
                  <p className="type-kicker">Synced from Jira</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {syncedTickets.slice(0, 10).map((t) => (
                      <button
                        key={t.jiraKey}
                        type="button"
                        onClick={() => selectFromList(t.jiraKey)}
                        className="rounded-full border border-app-border px-2.5 py-1 text-[12px] text-app-ink-dim hover:border-indigo/40 hover:text-indigo"
                        title={t.summary}
                      >
                        {t.jiraKey}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {intakeTickets.length > 0 && (
                <div>
                  <p className="type-kicker">AI Worker intake</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {intakeTickets.slice(0, 8).map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => selectFromList(t.key)}
                        className="rounded-full border border-indigo/30 bg-indigo/10 px-2.5 py-1 text-[12px] text-indigo hover:border-indigo"
                      >
                        {t.key}
                      </button>
                    ))}
                  </div>
                </div>
              )}            </div>
          )}
          {error && (
            <p className="border-t border-hairline px-5 py-3 text-[13px] text-danger sm:px-6">{error}</p>
          )}
        </Panel>

        <Panel>
          <PanelHeader kicker="History" title="Recent analyses" />
          <ul className="max-h-[220px] overflow-y-auto px-3 py-2">
            {(listData?.items ?? []).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => selectFromList(item.jiraKey)}
                  className={`w-full rounded-lg px-3 py-2 text-left hover:bg-canvas/50 ${
                    activeKey === item.jiraKey ? "bg-indigo/10" : ""
                  }`}
                >
                  <p className="text-[12px] font-medium text-app-ink">{item.jiraKey}</p>
                  <p className="truncate text-[11px] text-app-ink-dim">{item.summary}</p>
                  <p className="mt-0.5 type-kicker">{item.status}</p>                </button>
              </li>
            ))}
            {!listData?.items?.length && (
              <li className="px-3 py-4 text-[13px] text-ink-dim">No analyses yet.</li>
            )}
          </ul>
        </Panel>
      </div>

      {isRunning && !analysis?.enrichment && (
        <div className="flex items-center justify-center gap-3 py-10">
          <Spinner />
          <p className="text-sm text-app-ink-dim">
            Running PM pipeline ({PM_STAGE_ORDER.length} stages)…
          </p>
        </div>
      )}

      {analysis && (
        <PmAnalysisOutputs
          analysis={analysis}
          onRetrospective={handleRetrospective}
          retroRunning={retroRunning}
          onResume={analysis.status === "FAILED" ? handleResume : undefined}
          resuming={analyzing}
          resumeStageLabel={
            analysis.status === "FAILED"
              ? PM_STAGE_LABELS[getPmResumeStage(analysis)] ?? null
              : null
          }
        />
      )}
    </AnimatedAppPage>
  );
}