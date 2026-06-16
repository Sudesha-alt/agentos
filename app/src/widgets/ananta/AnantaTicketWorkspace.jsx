import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useEngineeringRun } from "../../entities/engineering-agent";
import { AGENT_NAMES } from "../../shared/config/app";
import { Panel } from "../../shared/ui/Panel";

const SECTIONS = [
  { id: "plan", label: "Implementation Plan" },
  { id: "files", label: "Files Written" },
  { id: "tools", label: "Tool Call Log" },
  { id: "pr", label: "PR Details" },
];

export default function AnantaTicketWorkspace({
  pipelineId,
  jiraKey,
  onClearSelection,
  handoffPending = false,
}) {
  const { run, loading } = useEngineeringRun(pipelineId, { pollMs: 8_000 });
  const [section, setSection] = useState("plan");
  const [selectedFile, setSelectedFile] = useState(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [fileTab, setFileTab] = useState("raw");
  const [costOpen, setCostOpen] = useState(false);

  const coverageLabel = useMemo(() => {
    if (!run) return null;
    const mapped = run.criteriaMapped ?? 0;
    const total = run.criteriaTotal ?? 0;
    if (mapped >= total) return `${mapped} of ${total} criteria mapped ✓`;
    return `${mapped} of ${total} criteria mapped ⚠`;
  }, [run]);

  const coverageOk = run && run.criteriaMapped >= run.criteriaTotal;

  if (!pipelineId && handoffPending) {
    return (
      <Panel className="flex flex-col items-center px-8 py-16 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-indigo/10 font-display text-2xl text-indigo">
          A
        </div>
        <h2 className="mt-6 text-xl font-semibold text-app-ink">
          {jiraKey} — handoff received
        </h2>
        <p className="mt-2 max-w-md text-sm text-app-ink-dim">
          Virin completed the engineering handoff. The coding pipeline will appear here once
          {AGENT_NAMES.ANANTA} starts writing files.
        </p>
        <Link
          to={`/app/pm-agents?ticket=${encodeURIComponent(jiraKey)}`}
          className="mt-6 text-sm font-medium text-indigo hover:underline"
        >
          View handoff in Virin →
        </Link>
      </Panel>
    );
  }

  if (!pipelineId) {
    return <AnantaEmptyState />;
  }

  if (loading && !run) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-app-ink-dim">
        Loading {AGENT_NAMES.ANANTA} run…
      </div>
    );
  }

  if (!run) {
    return (
      <Panel className="p-8 text-center">
        <p className="text-sm text-app-ink-dim">No engineering output for this pipeline yet.</p>
        <button
          type="button"
          onClick={() => onClearSelection?.()}
          className="mt-4 text-sm font-medium text-indigo hover:underline"
        >
          Back to list
        </button>
      </Panel>
    );
  }

  const isLive = run.status === "RUNNING" && run.liveSteps?.length;

  return (
    <div className="flex min-h-[calc(100vh-12rem)] flex-col">
      <header className="app-card border border-app-border px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="type-kicker">{AGENT_NAMES.ANANTA} · Tech</p>
            <h1 className="mt-1 text-lg font-semibold text-app-ink">
              {run.jiraKey} — {run.summary}
            </h1>
            <p className="mt-2 text-sm text-app-ink-dim">
              Branch:{" "}
              <span className="font-mono text-app-ink">{run.branch}</span>
              {run.prNumber ? (
                <>
                  {" "}
                  · PR #{run.prNumber} {run.prDraft ? "(Draft)" : ""}
                </>
              ) : null}
            </p>
            <p className="mt-1 text-sm text-app-ink-dim">
              Stage:{" "}
              <span className="inline-flex items-center gap-1.5 font-medium text-indigo">
                <span className="size-1.5 animate-pulse rounded-full bg-indigo" />
                {run.status}
              </span>
              · Duration: {run.durationMinutes} min · Cost: ${run.costUsd?.toFixed(2)}
            </p>
            <p className="mt-1 text-xs text-app-ink-mute">
              Files created: {run.filesCreated} · Modified: {run.filesModified} · Tests:{" "}
              {run.testsGenerated}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isLive ? (
              <button
                type="button"
                className="rounded-full border border-danger/40 px-3 py-1.5 text-xs font-medium text-danger"
              >
                Cancel run
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="rounded-full border border-app-border px-3 py-1.5 text-xs text-app-ink-dim hover:text-app-ink"
            >
              History
            </button>
            {run.pr?.url ? (
              <a
                href={run.pr.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-app-border px-3 py-1.5 text-xs font-medium text-app-ink"
              >
                View on GitHub ↗
              </a>
            ) : null}
            <Link
              to={`/app/pipelines/${run.pipelineId}/prd`}
              className="rounded-full border border-app-border px-3 py-1.5 text-xs font-medium text-app-ink"
            >
              View PRD
            </Link>
            <Link
              to="/app/qa"
              className="rounded-full border border-app-border px-3 py-1.5 text-xs font-medium text-app-ink"
            >
              View QA Report
            </Link>
          </div>
        </div>
      </header>

      <div className="mt-4 flex flex-1 flex-col gap-4 lg:flex-row">
        <aside className="w-full shrink-0 lg:w-56">
          <nav className="app-card space-y-1 border border-app-border p-2">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setSection(s.id);
                  if (s.id !== "files") setSelectedFile(null);
                }}
                className={`flex w-full flex-col items-start rounded-app-sm px-3 py-2.5 text-left text-sm transition ${
                  section === s.id
                    ? "bg-app-lavender/40 font-medium text-app-ink"
                    : "text-app-ink-dim hover:bg-app-surface-muted"
                }`}
              >
                <span>{s.label}</span>
                {s.id === "plan" && coverageLabel ? (
                  <span
                    className={`mt-1 text-[11px] ${coverageOk ? "text-success" : "text-warning"}`}
                  >
                    {coverageLabel}
                  </span>
                ) : null}
              </button>
            ))}
            {section === "files" || selectedFile ? (
              <div className="mt-3 border-t border-app-border pt-2">
                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-app-ink-mute">
                  File tree
                </p>
                <ul className="max-h-48 overflow-y-auto">
                  {(run.files ?? []).map((file) => (
                    <li key={file.path}>
                      <button
                        type="button"
                        onClick={() => {
                          setSection("files");
                          setSelectedFile(file.path);
                        }}
                        className={`w-full truncate px-3 py-1.5 text-left font-mono text-[11px] ${
                          selectedFile === file.path
                            ? "bg-violet-100 text-violet-900"
                            : "text-app-ink-dim hover:bg-app-surface-muted"
                        }`}
                      >
                        {file.change === "created" ? "+" : "~"} {file.path.split("/").pop()}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <Panel className="min-h-[420px] border border-app-border">
            {isLive ? (
              <LiveRunPanel steps={run.liveSteps} />
            ) : section === "plan" && !selectedFile ? (
              <ImplementationPlanView plan={run.implementationPlan} />
            ) : section === "files" || selectedFile ? (
              <FileContentView
                file={(run.files ?? []).find((f) => f.path === selectedFile) ?? run.files?.[0]}
                fileTab={fileTab}
                onTabChange={setFileTab}
                defaultPlan={run.implementationPlan}
              />
            ) : section === "tools" ? (
              <ToolCallLogView calls={run.toolCalls} />
            ) : section === "pr" ? (
              <PrDetailsView pr={run.pr} />
            ) : (
              <ImplementationPlanView plan={run.implementationPlan} />
            )}
          </Panel>
        </main>
      </div>

      {!isLive ? (
        <footer className="sticky bottom-0 mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-app-border bg-app-surface/95 px-4 py-3 backdrop-blur">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-full bg-indigo px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo/90"
            >
              Approve & Mark PR Ready
            </button>
            <button
              type="button"
              className="rounded-full border border-app-border px-4 py-2 text-sm font-medium text-app-ink"
            >
              Request Changes
            </button>
          </div>
          <button
            type="button"
            onClick={() => setCostOpen((v) => !v)}
            className="text-sm text-app-ink-dim hover:text-app-ink"
          >
            ${run.costUsd?.toFixed(2)} — {run.toolCallCount} tool calls — {run.durationMinutes}{" "}
            min
          </button>
          {costOpen ? (
            <div className="w-full rounded-app-sm border border-app-border bg-app-surface-muted px-4 py-3 text-xs text-app-ink-dim">
              Token breakdown by phase — engineering plan, coding loop, sandbox compile. Full
              ticket cost includes Product and QA stages.
            </div>
          ) : null}
        </footer>
      ) : null}

      {historyOpen ? (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/20"
          role="presentation"
          onClick={() => setHistoryOpen(false)}
        >
          <div
            className="h-full w-full max-w-md overflow-y-auto border-l border-app-border bg-app-surface p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-app-ink">Historical context</h2>
            <p className="mt-1 text-sm text-app-ink-dim">
              Recent engineering work in this area of the codebase.
            </p>
            <ul className="mt-6 space-y-4">
              {(run.history ?? []).map((h) => (
                <li
                  key={h.jiraKey}
                  className="rounded-app-sm border border-app-border px-4 py-3"
                >
                  <p className="font-mono text-xs text-app-ink-mute">{h.jiraKey}</p>
                  <p className="mt-1 text-sm font-medium text-app-ink">{h.summary}</p>
                  <p className="mt-2 text-xs text-app-ink-dim">QA: {h.qaFindings}</p>
                  <p className="mt-1 text-xs text-app-ink-dim">Human: {h.humanChanges}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AnantaEmptyState() {
  return (
    <Panel className="flex flex-col items-center px-8 py-16 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-indigo/10 font-display text-2xl text-indigo">
        A
      </div>
      <h2 className="mt-6 text-xl font-semibold text-app-ink">
        Select a ticket to review implementation
      </h2>
      <p className="mt-2 max-w-md text-sm text-app-ink-dim">
        Tickets appear here after Virin completes analysis and hands off to {AGENT_NAMES.ANANTA}.
        Live file edits, diffs, and tool calls show in the editor as the agent works.
      </p>
      <Link
        to="/app/pm-agents"
        className="mt-6 rounded-full bg-indigo px-5 py-2.5 text-sm font-medium text-white"
      >
        Open Virin workspace
      </Link>
    </Panel>
  );
}

function LiveRunPanel({ steps }) {
  return (
    <div className="px-5 py-6 sm:px-6">
      <p className="type-kicker">{AGENT_NAMES.ANANTA} — Live</p>
      <ul className="mt-4 space-y-2">
        {steps.map((step) => (
          <li key={step.id} className="flex items-start gap-3 text-sm">
            <span
              className={`mt-1 size-2 shrink-0 rounded-full ${
                step.status === "in_progress"
                  ? "animate-pulse bg-indigo"
                  : step.status === "complete"
                    ? "bg-success"
                    : "bg-app-ink-mute/40"
              }`}
            />
            <div>
              <p className="text-app-ink">
                {step.label}{" "}
                {step.status === "complete" ? (
                  <span className="text-success">complete ✓</span>
                ) : step.status === "in_progress" ? (
                  <span className="text-indigo">IN PROGRESS</span>
                ) : null}
              </p>
              {step.detail ? (
                <p className="text-xs text-app-ink-mute">{step.detail}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ImplementationPlanView({ plan }) {
  if (!plan) {
    return (
      <p className="px-6 py-8 text-sm text-app-ink-dim">Implementation plan not ready.</p>
    );
  }
  return (
    <div className="px-5 py-6 sm:px-6 prose-sm max-w-none">
      <h2 className="text-base font-semibold text-app-ink">Implementation plan</h2>
      <section className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-app-ink-mute">
          Technical summary
        </h3>
        <p className="mt-2 text-sm text-app-ink-dim">{plan.technicalSummary}</p>
      </section>
      <section className="mt-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-app-ink-mute">
          Acceptance criteria coverage
        </h3>
        <ul className="mt-3 space-y-3">
          {plan.criteria?.map((c) => (
            <li key={c.id} className="rounded-app-sm border border-app-border px-3 py-2 text-sm">
              <p className="text-success">✓ {c.text}</p>
              <p className="mt-1 font-mono text-xs text-app-ink-dim">
                → {c.implementation} · Test: {c.test}
              </p>
            </li>
          ))}
        </ul>
      </section>
      {plan.risks?.length ? (
        <section className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-app-ink-mute">
            Risks identified
          </h3>
          {plan.risks.map((r, i) => (
            <p key={i} className="mt-2 text-sm text-warning">
              ⚠ {r.level}: {r.text}
            </p>
          ))}
        </section>
      ) : null}
    </div>
  );
}

function FileContentView({ file, fileTab, onTabChange, defaultPlan }) {
  if (!file) {
    return <ImplementationPlanView plan={defaultPlan} />;
  }
  return (
    <div className="px-5 py-4 sm:px-6">
      <p className="font-mono text-xs text-violet-700">{file.path}</p>
      <p className="mt-2 text-sm text-app-ink-dim">{file.summary}</p>
      {file.humanModified ? (
        <p className="mt-2 rounded-app-sm border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
          Modified by human after agent wrote this file
        </p>
      ) : null}
      <div className="mt-4 flex gap-2">
        {["raw", "diff"].map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              fileTab === tab
                ? "bg-app-ink text-white"
                : "border border-app-border text-app-ink-dim"
            }`}
          >
            {tab === "raw" ? "Raw file" : "Diff"}
          </button>
        ))}
      </div>
      <pre className="mt-4 overflow-x-auto rounded-app-sm border border-app-border bg-app-surface-muted p-4 font-mono text-xs text-app-ink">
        {fileTab === "diff" && file.diff ? file.diff : file.content}
      </pre>
    </div>
  );
}

function ToolCallLogView({ calls }) {
  return (
    <div className="px-5 py-4 sm:px-6">
      <p className="text-sm font-medium text-app-ink">
        Tool call log ({calls?.length ?? 0} calls)
      </p>
      <ol className="mt-4 space-y-2">
        {(calls ?? []).map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between rounded-app-sm border border-app-border px-3 py-2 font-mono text-xs"
          >
            <span>
              {c.id} {c.name}
            </span>
            <span className="text-app-ink-mute">{c.durationSec}s</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function PrDetailsView({ pr }) {
  if (!pr) {
    return <p className="px-6 py-8 text-sm text-app-ink-dim">No pull request yet.</p>;
  }
  return (
    <div className="px-5 py-6 sm:px-6">
      <h2 className="text-base font-semibold text-app-ink">{pr.title}</h2>
      <p className="mt-2 text-sm text-app-ink-dim">{pr.description}</p>
      <p className="mt-4 text-xs text-app-ink-mute">
        Labels: {pr.labels?.join(", ")} · {pr.draft ? "Draft" : "Ready"}
      </p>
      <a
        href={pr.url}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex text-sm font-medium text-indigo hover:underline"
      >
        Open on GitHub ↗
      </a>
    </div>
  );
}
