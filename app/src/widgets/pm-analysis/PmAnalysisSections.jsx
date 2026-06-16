import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  PM_STAGE_ORDER,
  PM_STAGE_LABELS,
  VIRIN_NAME,
  getPmHandoff,
  startPmCodingPipeline,
} from "../../entities/pm-agents";
import {
  VirinCodebaseSection,
  VirinConversationPanel,
  VirinDiscoverySection,
  VirinHandoffPackageSection,
  VirinIntakeSection,
  VirinPostShipSection,
} from "./VirinSections";
import { CompetitorAnalysisSection } from "./CompetitorAnalysisSection";
import { Panel, PanelHeader } from "../../shared/ui/Panel";
import { motionSafe, pageStagger, sectionFadeUp } from "../../lib/motion";

export function PmStageProgress({ analysis }) {
  const current = analysis?.currentStage;
  const meta = analysis?.stageMeta ?? [];

  return (
    <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {PM_STAGE_ORDER.map((stage) => {
        const done = meta.some((m) => m.stage === stage && m.status === "COMPLETED");
        const running = current === stage;
        const failed = meta.some((m) => m.stage === stage && m.status === "FAILED");
        return (
          <li
            key={stage}
            className={`rounded-xl border px-3 py-2.5 ${
              running
                ? "border-indigo bg-indigo/10"
                : done
                  ? "border-success/40 bg-success/5"
                  : failed
                    ? "border-danger/40 bg-danger/5"
                    : "border-hairline bg-canvas/40"
            }`}
          >
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-mute">
              {PM_STAGE_LABELS[stage]}
            </p>
            <p className="mt-1 text-[12px] text-ink-dim">
              {running ? "Running…" : done ? "Complete" : failed ? "Failed" : "Pending"}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

function JsonCard({ kicker, title, data, children }) {
  if (!data && !children) return null;
  return (
    <Panel>
      <PanelHeader kicker={kicker} title={title} />
      <div className="px-5 py-4 sm:px-6">
        {children ?? (
          <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-ink-dim">
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </div>
    </Panel>
  );
}

export function PmBriefSection({ enrichment }) {
  if (!enrichment) return null;
  return (
    <JsonCard kicker="Stage 1" title="Enriched brief">
      <div className="space-y-4 text-[14px] leading-relaxed text-ink-dim">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">Summary</p>
          <p className="mt-1 text-ink">{enrichment.cleanSummary}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">User problem</p>
          <p className="mt-1">{enrichment.realUserProblem}</p>
        </div>
        {enrichment.redFlags?.length > 0 && (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-danger">Red flags</p>
            <ul className="mt-1 list-disc pl-5">
              {enrichment.redFlags.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        )}
        {enrichment.missingContext?.length > 0 && (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">Missing context</p>
            <ul className="mt-1 list-disc pl-5">
              {enrichment.missingContext.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </JsonCard>
  );
}

export function PmClassificationSection({ classification }) {
  if (!classification) return null;
  const tone =
    classification.severity === "critical" || classification.severity === "high"
      ? "text-danger"
      : classification.severity === "medium"
        ? "text-warning"
        : "text-ink";
  return (
    <JsonCard kicker="Stage 2" title="Classification & severity">
      <div className="flex flex-wrap gap-3">
        <span className="rounded-full border border-hairline px-3 py-1 font-mono text-[11px] uppercase">
          {classification.type} / {classification.subtype}
        </span>
        <span className={`rounded-full border border-hairline px-3 py-1 font-mono text-[11px] uppercase ${tone}`}>
          {classification.severity}
        </span>
        <span className="rounded-full border border-hairline px-3 py-1 font-mono text-[11px]">
          Confidence {classification.classificationConfidence}%
        </span>
        {classification.requiresHumanEscalation && (
          <span className="rounded-full border border-danger/50 bg-danger/10 px-3 py-1 font-mono text-[11px] text-danger">
            Escalation required
          </span>
        )}
      </div>
      <p className="mt-4 text-[14px] text-ink-dim">{classification.severityReasoning}</p>
    </JsonCard>
  );
}

export function PmImpactSection({ impact }) {
  if (!impact) return null;
  return (
    <JsonCard kicker="Stage 3" title="Codebase impact">
      <p className="mb-4 text-[14px] text-ink-dim">{impact.scopeAssessment}</p>
      <ul className="space-y-3">
        {impact.affectedFiles?.map((f) => (
          <li key={f.path} className="rounded-lg border border-hairline bg-canvas/30 px-3 py-2">
            <p className="font-mono text-[12px] text-indigo">{f.path}</p>
            <p className="mt-1 text-[13px] text-ink-dim">{f.reason}</p>
            <p className="mt-1 font-mono text-[10px] text-ink-mute">
              {f.role} · risk {f.riskLevel} · {f.confidence}% confidence
            </p>
          </li>
        ))}
      </ul>
      {impact.suggestedFirstFile && (
        <p className="mt-4 text-[13px] text-ink-dim">
          <span className="font-mono text-[10px] uppercase text-ink-mute">Start here: </span>
          {impact.suggestedFirstFile}
        </p>
      )}
    </JsonCard>
  );
}

const PIPELINE_BREAKDOWN_LABELS = {
  discovery: "Discovery (Virin)",
  engineering: "Engineering (Ananta)",
  qa: "QA (Neel)",
  review: "Review",
};

export function PmEffortSection({ effort }) {
  if (!effort) return null;
  return (
    <JsonCard kicker="Stage 4" title="Agent pipeline estimate">
      <div className="flex flex-wrap gap-3">
        <span className="rounded-full bg-indigo/15 px-3 py-1 font-display text-[1.2rem] text-indigo">
          {effort.tshirt}
        </span>
        <span className="rounded-full border border-hairline px-3 py-1 font-mono text-[12px]">
          Pipeline complexity {effort.storyPoints}
        </span>
        <span className="rounded-full border border-hairline px-3 py-1 font-mono text-[12px]">
          {effort.confidenceInEstimate}% confidence
        </span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {Object.entries(effort.breakdown ?? {}).map(([k, v]) => (
          <div key={k} className="rounded-lg border border-hairline px-3 py-2">
            <p className="font-mono text-[10px] uppercase text-ink-mute">
              {PIPELINE_BREAKDOWN_LABELS[k] ?? k}
            </p>
            <p className="text-[13px] text-ink">{v}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[14px] text-ink-dim">{effort.recommendedApproach}</p>
    </JsonCard>
  );
}

export function PmImplementationSection({ impl }) {
  if (!impl) return null;
  return (
    <JsonCard kicker="Stage 5" title="Implementation suggestion">
      <p className="text-[14px] text-ink-dim">{impl.approachSummary}</p>
      <ol className="mt-4 space-y-3">
        {impl.implementationSteps?.map((s) => (
          <li key={s.step} className="rounded-lg border border-hairline px-3 py-2">
            <p className="font-mono text-[11px] text-indigo">Step {s.step}</p>
            <p className="mt-1 text-[13px] text-ink">{s.action}</p>
            <p className="mt-1 text-[12px] text-ink-dim">{s.why}</p>
            {s.watchOut && (
              <p className="mt-1 text-[12px] text-warning">Watch out: {s.watchOut}</p>
            )}
          </li>
        ))}
      </ol>
    </JsonCard>
  );
}

export function PmPrioritizationSection({ prio }) {
  if (!prio) return null;
  const recTone =
    prio.recommendation === "NOW"
      ? "bg-success/15 text-success border-success/30"
      : prio.recommendation === "WONT_DO"
        ? "bg-danger/10 text-danger border-danger/30"
        : "bg-indigo/10 text-indigo border-indigo/30";
  return (
    <JsonCard kicker="Stage 6" title="Prioritization">
      <span className={`inline-block rounded-full border px-4 py-1.5 font-mono text-[12px] uppercase tracking-[0.12em] ${recTone}`}>
        {prio.recommendation}
      </span>
      <p className="mt-4 text-[14px] text-ink-dim">{prio.recommendationReasoning}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="font-mono text-[10px] uppercase text-ink-mute">Cost of inaction</p>
          <p className="mt-1 text-[13px] text-ink-dim">{prio.costOfInaction}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase text-ink-mute">Tradeoff</p>
          <p className="mt-1 text-[13px] text-ink-dim">{prio.tradeoff}</p>
        </div>
      </div>
    </JsonCard>
  );
}

export function PmPrdSection({ prd }) {
  if (!prd) return null;
  return (
    <JsonCard kicker="Stage 8" title="Generated PRD">
      <div className="space-y-4 text-[14px] leading-relaxed text-ink-dim">
        <div>
          <p className="font-display text-[1.25rem] text-ink">{prd.title}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full border border-hairline px-3 py-1 font-mono text-[11px]">
              {prd.jiraKey}
            </span>
            <span className="rounded-full border border-hairline px-3 py-1 font-mono text-[11px]">
              {prd.effortEstimate}
            </span>
            <span className="rounded-full border border-hairline px-3 py-1 font-mono text-[11px]">
              Confidence {Math.round((prd.prdConfidence ?? 0) * 100)}%
            </span>
          </div>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">Problem</p>
          <p className="mt-1 text-ink">{prd.problemStatement}</p>
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">Proposed solution</p>
          <p className="mt-1">{prd.proposedSolution}</p>
        </div>
        {prd.userStories?.length > 0 && (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
              User stories ({prd.userStories.length})
            </p>
            <ul className="mt-2 space-y-2">
              {prd.userStories.map((story) => (
                <li key={story.id} className="rounded-lg border border-hairline px-3 py-2">
                  <p className="font-mono text-[11px] text-indigo">{story.id} · {story.priority}</p>
                  <p className="mt-1 text-[13px] text-ink">{story.story}</p>
                  {story.acceptanceCriteria?.length > 0 && (
                    <ul className="mt-2 list-disc pl-5 text-[12px]">
                      {story.acceptanceCriteria.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {prd.openQuestions?.length > 0 && (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">Open questions</p>
            <ul className="mt-1 list-disc pl-5">
              {prd.openQuestions.map((q) => (
                <li key={q.question}>{q.question}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </JsonCard>
  );
}

export function PmAcceptanceSection({ ac }) {
  if (!ac) return null;
  return (
    <JsonCard kicker="Stage 7" title="Acceptance criteria">
      <p className="text-[14px] italic text-ink">{ac.userStory}</p>
      <div className="mt-4 space-y-3">
        {ac.happyPath?.map((c, i) => (
          <div key={i} className="rounded-lg border border-hairline px-3 py-2 text-[13px]">
            <p><span className="font-mono text-[10px] text-ink-mute">GIVEN</span> {c.given}</p>
            <p className="mt-1"><span className="font-mono text-[10px] text-ink-mute">WHEN</span> {c.when}</p>
            <p className="mt-1"><span className="font-mono text-[10px] text-ink-mute">THEN</span> {c.then}</p>
          </div>
        ))}
      </div>
    </JsonCard>
  );
}

export function PmArtifactsSection({ artifacts }) {
  if (!artifacts) return null;
  const items = [
    { key: "engineeringPing", label: "Engineering ping", kicker: "Slack" },
    { key: "stakeholderUpdate", label: "Stakeholder update", kicker: "External" },
    { key: "pmOneLiner", label: "PM one-liner", kicker: "Roadmap" },
    { key: "sprintPlanningNote", label: "Sprint planning note", kicker: "Ceremony" },
  ];
  return (
    <Panel>
      <PanelHeader kicker="Stage 9" title="Communication artifacts" />
      <div className="grid gap-4 px-5 py-4 sm:grid-cols-2 sm:px-6">
        {items.map(({ key, label, kicker }) => (
          <div key={key} className="rounded-xl border border-hairline bg-canvas/30 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">{kicker}</p>
            <p className="mt-1 font-display text-[1.1rem] text-ink">{label}</p>
            <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-dim">
              {artifacts[key]}
            </p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function PmRetrospectiveSection({ retrospective, onRun, running }) {
  return (
    <Panel>
      <PanelHeader
        kicker="Stage 10"
        title="Retrospective & learning"
        right={
          onRun ? (
            <button
              type="button"
              disabled={running}
              onClick={onRun}
              className="rounded-full border border-hairline px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim hover:border-indigo hover:text-indigo disabled:opacity-50"
            >
              {running ? "Running…" : "Run retrospective"}
            </button>
          ) : null
        }
      />
      <div className="px-5 py-4 sm:px-6">
        {retrospective ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Classification", retrospective.classificationAccuracy],
              ["Severity", retrospective.severityAccuracy],
              ["Priority", retrospective.priorityAccuracy],
              ["Effort", retrospective.effortAccuracy],
            ].map(([label, val]) => (
              <div key={label} className="rounded-lg border border-hairline px-3 py-2">
                <p className="font-mono text-[10px] uppercase text-ink-mute">{label}</p>
                <p className="mt-1 text-[13px] text-ink">{val}</p>
              </div>
            ))}
            <div className="sm:col-span-2">
              <p className="font-mono text-[10px] uppercase text-ink-mute">Learning signals</p>
              <ul className="mt-2 list-disc pl-5 text-[13px] text-ink-dim">
                {retrospective.learningSignals?.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p className="text-[14px] text-ink-dim">
            Run retrospective after the ticket is closed to evaluate agent accuracy and capture learning signals.
          </p>
        )}
      </div>
    </Panel>
  );
}

export function PmTechHandoffSection({ jiraKey, analysisComplete }) {
  const navigate = useNavigate();
  const [handoffData, setHandoffData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copyState, setCopyState] = useState(null);
  const [handoffError, setHandoffError] = useState(null);
  const [startingPipeline, setStartingPipeline] = useState(false);
  const [pipelineMsg, setPipelineMsg] = useState(null);

  async function handleHandoff() {
    setLoading(true);
    setHandoffError(null);
    try {
      const result = await getPmHandoff(jiraKey);
      setHandoffData(result);
    } catch (err) {
      const msg = err.message ?? "Handoff failed";
      setHandoffError(
        msg.includes("not found")
          ? `${msg} — re-run Analyze ticket if the server restarted since this analysis completed.`
          : msg
      );
      setHandoffData(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleStartPipeline() {
    setStartingPipeline(true);
    setPipelineMsg(null);
    setHandoffError(null);
    try {
      const result = await startPmCodingPipeline(jiraKey);
      setPipelineMsg(result.message ?? "Coding pipeline started.");
      const params = new URLSearchParams({ ticket: jiraKey });
      if (result.pipelineId) params.set("pipeline", result.pipelineId);
      navigate(`/app/ananta?${params.toString()}`);
    } catch (err) {
      const msg = err.message ?? "Failed to start coding pipeline";
      setHandoffError(
        msg.includes("not found")
          ? `${msg} — re-run Analyze ticket if the server restarted since this analysis completed.`
          : msg
      );
    } finally {
      setStartingPipeline(false);
    }
  }

  async function copyPrompt() {
    if (!handoffData?.prompt) return;
    try {
      await navigator.clipboard.writeText(handoffData.prompt);
      setCopyState("copied");
      setTimeout(() => setCopyState(null), 2000);
    } catch {
      setCopyState("failed");
    }
  }

  if (!analysisComplete) return null;

  return (
    <Panel>
      <PanelHeader
        kicker="Engineering handoff"
        title="Tech Agent Handoff"
        right={
          <div className="flex flex-wrap gap-2">
            <Link
              to={`/app/ananta?ticket=${encodeURIComponent(jiraKey)}`}
              className="rounded-full border border-hairline px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-indigo hover:border-indigo"
            >
              Open in Ananta
            </Link>
            <button
              type="button"
              disabled={loading}
              onClick={handleHandoff}
              className="rounded-full border border-hairline px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-dim hover:border-indigo hover:text-indigo disabled:opacity-50"
            >
              {loading ? "Building…" : "Preview handoff"}
            </button>
            <button
              type="button"
              disabled={startingPipeline}
              onClick={handleStartPipeline}
              className="rounded-full bg-indigo px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white hover:bg-indigo/90 disabled:opacity-50"
            >
              {startingPipeline ? "Starting…" : "Start coding pipeline"}
            </button>
          </div>
        }
      />
      <div className="px-5 py-4 sm:px-6">
        <p className="text-[14px] text-ink-dim">
          Start coding enqueues the engineering pipeline with the PM PRD (skips discovery when PRD exists).
          Preview handoff copies the engineer-ready prompt and file snapshots.
        </p>
        {pipelineMsg && (
          <p className="mt-3 text-[13px] text-success">{pipelineMsg}</p>
        )}
        {handoffError && (
          <p className="mt-3 text-[13px] text-danger">{handoffError}</p>
        )}
        {handoffData && (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-hairline px-3 py-1 font-mono text-[11px] uppercase">
                {handoffData.handoff?.recommendation ?? "—"}
              </span>
              <span className="font-mono text-[11px] text-ink-dim">
                Start: {handoffData.handoff?.suggestedFirstFile}
              </span>
              {handoffData.handoff?.jiraUrl && (
                <a
                  href={handoffData.handoff.jiraUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[11px] text-indigo hover:underline"
                >
                  Open in Jira
                </a>
              )}
              <button
                type="button"
                onClick={copyPrompt}
                className="rounded-full border border-hairline px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-dim hover:border-indigo hover:text-indigo"
              >
                {copyState === "copied" ? "Copied" : copyState === "failed" ? "Copy failed" : "Copy prompt"}
              </button>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">Handoff prompt</p>
              <pre className="mt-2 max-h-[420px] overflow-auto whitespace-pre-wrap rounded-xl border border-hairline bg-canvas/40 p-4 font-mono text-[11px] leading-relaxed text-ink-dim">
                {handoffData.prompt}
              </pre>
            </div>
            {handoffData.codeSnapshots?.length > 0 && (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                  Primary file snapshots ({handoffData.codeSnapshots.length})
                </p>
                <div className="mt-2 space-y-3">
                  {handoffData.codeSnapshots.map((snap) => (
                    <div key={snap.path} className="rounded-xl border border-hairline bg-canvas/30 p-3">
                      <p className="font-mono text-[12px] text-indigo">{snap.path}</p>
                      {snap.error ? (
                        <p className="mt-2 text-[12px] text-danger">{snap.error}</p>
                      ) : (
                        <pre className="mt-2 max-h-[280px] overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-ink-dim">
                          {snap.content}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Panel>
  );
}

export function PmAnalysisOutputs({
  analysis,
  onRetrospective,
  retroRunning,
  onResume,
  resuming,
  resumeStageLabel,
  onAnswer,
  onConfirm,
  interactionBusy,
}) {
  if (!analysis) return null;

  const sections = [
    <Panel key="progress">
      <PanelHeader
        kicker={analysis.jiraKey}
        title={analysis.ticketInput?.summary ?? `${VIRIN_NAME} analysis`}
        right={
          <span className="type-kicker">
            {analysis.status}
            {analysis.costUsd != null ? ` · $${analysis.costUsd.toFixed(3)}` : ""}
          </span>
        }
      />
      <div className="px-5 py-4 sm:px-6">
        <PmStageProgress analysis={analysis} />
      </div>
    </Panel>,
    <VirinConversationPanel
      key="conversation"
      analysis={analysis}
      onAnswer={onAnswer}
      onConfirm={onConfirm}
      busy={interactionBusy}
    />,
    <VirinIntakeSection key="intake" intake={analysis.neelIntake} />,
    <VirinDiscoverySection key="discovery" questionMode={analysis.questionMode} />,
    <CompetitorAnalysisSection key="competitors" competitorAnalysis={analysis.competitorAnalysis} />,
    <VirinCodebaseSection key="codebase" analysis={analysis.codebaseAnalysis} />,
    analysis.solutioning?.humanConfirmed || analysis.status === "COMPLETED" ? (
      <Panel key="solution">
        <PanelHeader kicker="Stage 4" title="Confirmed solution direction" />
        <div className="px-5 py-4 sm:px-6 whitespace-pre-wrap text-[14px] text-ink-dim">
          {analysis.solutioning?.summaryMarkdown ?? analysis.solutioning?.recommendedApproach}
        </div>
      </Panel>
    ) : null,
    <PmPrdSection key="prd" prd={analysis.generatedPrd} />,
    <VirinHandoffPackageSection key="handoff-pkg" handoffPackage={analysis.handoffPackage} />,
    <VirinPostShipSection key="postship" postShip={analysis.postShip} />,
    <PmTechHandoffSection
      key="handoff"
      jiraKey={analysis.jiraKey}
      analysisComplete={analysis.status === "COMPLETED"}
    />,
    <PmRetrospectiveSection
      key="retro"
      retrospective={analysis.retrospective}
      onRun={onRetrospective}
      running={retroRunning}
    />,
    analysis.status === "FAILED" && analysis.error ? (
      <Panel key="error">
        <PanelHeader
          kicker="Error"
          title="Pipeline failed"
          right={
            onResume ? (
              <button
                type="button"
                disabled={resuming}
                onClick={onResume}
                className="rounded-full bg-indigo px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-white hover:bg-indigo/90 disabled:opacity-50"
              >
                {resuming
                  ? "Resuming…"
                  : `Resume${resumeStageLabel ? ` from ${resumeStageLabel}` : ""}`}
              </button>
            ) : null
          }
        />
        <p className="px-5 py-4 text-[13px] text-danger sm:px-6">{analysis.error}</p>
      </Panel>
    ) : null,
  ].filter(Boolean);

  const safeStagger = motionSafe(pageStagger(0.05));
  const safeSection = motionSafe(sectionFadeUp);

  return (
    <motion.div
      key={analysis.id ?? analysis.jiraKey}
      className="space-y-5"
      variants={safeStagger}
      initial="hidden"
      animate="show"
    >
      {sections.map((section, index) => (
        <motion.div key={section.key ?? index} variants={safeSection}>
          {section}
        </motion.div>
      ))}
    </motion.div>
  );
}
