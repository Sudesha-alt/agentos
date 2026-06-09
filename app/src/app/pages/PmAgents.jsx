import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  analyzePmTicket,
  PM_STAGE_ORDER,
  runPmRetrospective,
  usePmAnalysis,
  usePmAnalyses,
} from "../../entities/pm-agents";
import { useJiraSyncIssues } from "../../entities/jira-sync";
import { usePipelineIntakeTickets } from "../../entities/pipeline-jira";
import { PmAnalysisOutputs } from "../../widgets/pm-analysis/PmAnalysisSections";
import { PageIntro, Panel, PanelHeader } from "../../shared/ui/Panel";
import { EDITORIAL_METRICS } from "../../shared/config/app";
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
    pollMs: analyzing || analysis?.status === "RUNNING" ? 2500 : 0,
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
    <div className={`mx-auto w-full px-4 py-8 sm:px-6 ${EDITORIAL_METRICS.maxPageWidth}`}>
      <PageIntro
        kicker="Product operations"
        title="PM Agents"
        body="Nine-stage product intelligence pipeline — from ticket enrichment through prioritization, acceptance criteria, and stakeholder artifacts. Active runs also appear in Pipeline Explorer."
      />

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Panel>
          <PanelHeader kicker="Analyze" title="Ticket input" />
          <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-end sm:px-6">
            <label className="flex-1">
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">Jira key</span>
              <input
                type="text"
                value={ticketInput}
                onChange={(e) => setTicketInput(e.target.value)}
                placeholder="PLT-1287"
                className="mt-1.5 w-full rounded-xl border border-hairline bg-canvas px-3 py-2.5 font-mono text-[13px] text-ink outline-none focus:border-indigo"
              />
            </label>
            <button
              type="button"
              disabled={isRunning || !ticketInput.trim()}
              onClick={handleAnalyze}
              className="rounded-full bg-indigo px-6 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-white hover:bg-indigo/90 disabled:opacity-50"
            >
              {isRunning ? "Analyzing…" : "Analyze ticket"}
            </button>
          </div>
          {(syncedTickets.length > 0 || intakeTickets.length > 0) && (
            <div className="border-t border-hairline px-5 py-3 sm:px-6 space-y-3">
              {syncedTickets.length > 0 && (
                <div>
                  <p className="font-mono text-[10px] uppercase text-ink-mute">Synced from Jira</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {syncedTickets.slice(0, 10).map((t) => (
                      <button
                        key={t.jiraKey}
                        type="button"
                        onClick={() => selectFromList(t.jiraKey)}
                        className="rounded-full border border-hairline px-3 py-1 font-mono text-[11px] text-ink-dim hover:border-indigo hover:text-indigo"
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
                  <p className="font-mono text-[10px] uppercase text-ink-mute">AI Worker intake</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {intakeTickets.slice(0, 8).map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => selectFromList(t.key)}
                        className="rounded-full border border-indigo/30 bg-indigo/10 px-3 py-1 font-mono text-[11px] text-indigo hover:border-indigo"
                      >
                        {t.key}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
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
                  <p className="font-mono text-[12px] text-ink">{item.jiraKey}</p>
                  <p className="truncate text-[11px] text-ink-dim">{item.summary}</p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase text-ink-mute">{item.status}</p>
                </button>
              </li>
            ))}
            {!listData?.items?.length && (
              <li className="px-3 py-4 text-[13px] text-ink-dim">No analyses yet.</li>
            )}
          </ul>
        </Panel>
      </div>

      {isRunning && !analysis?.enrichment && (
        <div className="mt-8 flex items-center justify-center gap-3 py-12">
          <Spinner />
          <p className="font-mono text-[12px] text-ink-dim">
            Running PM pipeline ({PM_STAGE_ORDER.length} stages)…
          </p>
        </div>
      )}

      {analysis && (
        <div className="mt-8">
          <PmAnalysisOutputs
            analysis={analysis}
            onRetrospective={handleRetrospective}
            retroRunning={retroRunning}
          />
        </div>
      )}
    </div>
  );
}
