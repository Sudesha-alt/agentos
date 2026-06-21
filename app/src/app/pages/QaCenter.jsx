import { useState } from "react";
import {
  useQaCoverage,
  useQaHeatmap,
  useQaFailures,
  useQaReports,
  useQaPipelineReport,
} from "../../entities/qa";
import { TestCaseViewer } from "../../widgets/qa/TestCaseViewer";
import {
  triggerCanaryRun,
  useCanaryRuns,
} from "../../entities/canary";
import { useSettings } from "../../entities/settings";
import { Panel, PanelHeader } from "../../shared/ui/Panel";
import { AppTabButton } from "../../shared/ui/AppChrome";
import { Link } from "react-router-dom";
import { AnimatedAppPage } from "../../shared/ui/AnimatedAppPage";
import { AgentPageWithChat } from "../../widgets/agent-chat/AgentPageWithChat";
import { AgentPageHeader } from "../../widgets/agent-chat/AgentPageHeader";
import AgentPipelineLiveStatus from "../../shared/components/AgentPipelineLiveStatus";

const HEATMAP_CELL = {
  pass: "bg-success",
  warn: "bg-warning",
  fail: "bg-danger",
  na: "bg-ink-mute/30",
};

const SEVERITY_STYLES = {
  critical: "border-danger/40 bg-danger/10 text-danger",
  high: "border-warning/40 bg-warning/10 text-warning",
  medium: "border-indigo/30 bg-indigo/5 text-indigo",
  low: "border-app-border bg-app-surface-muted/40 text-app-ink-dim",
};

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "canary", label: "Canary" },
];

function formatWhen(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export default function QaCenter() {
  const [tab, setTab] = useState("overview");
  const [triggering, setTriggering] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState(null);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [selectedPipelineId, setSelectedPipelineId] = useState(null);

  const { data: coverage } = useQaCoverage();
  const { data: heatmap } = useQaHeatmap();
  const { data: failures } = useQaFailures();
  const { data: reports } = useQaReports();
  const { data: pipelineReport } = useQaPipelineReport(selectedPipelineId);
  const { data: canaryData, refetch: refetchCanary } = useCanaryRuns({ pollMs: 15_000 });
  const { data: settings } = useSettings();

  const runs = canaryData?.items ?? [];
  const selectedRun = runs.find((r) => r.id === selectedRunId) ?? runs[0] ?? null;

  async function handleTriggerCanary() {
    setTriggering(true);
    setTriggerMsg(null);
    try {
      const result = await triggerCanaryRun({
        environment: "staging",
        scope: "full",
        targetUrl: settings?.canaryStagingBaseUrl?.trim() || undefined,
      });
      setTriggerMsg(
        result.status === "already_running"
          ? "A canary run is already in progress."
          : "Canary run started."
      );
      refetchCanary();
    } catch (err) {
      setTriggerMsg(err instanceof Error ? err.message : "Failed to start canary run");
    } finally {
      setTriggering(false);
    }
  }

  const qaContextKey = selectedPipelineId || selectedRun?.id || "";

  return (
    <AnimatedAppPage wide>
      <AgentPageWithChat domain="neel" contextKey={qaContextKey}>
      <AgentPageHeader domain="neel" />

      <AgentPipelineLiveStatus agentKey="neel" />

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <AppTabButton key={t.id} active={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </AppTabButton>
        ))}
      </div>

      {tab === "overview" ? (
        <>
          <Panel>
            <PanelHeader kicker="Coverage" title="Test coverage by file" />
            <div className="grid gap-2 p-4 sm:grid-cols-2">
              {(coverage?.files ?? []).map((file) => (
                <div
                  key={file.path}
                  className="rounded-app-sm border border-app-border px-3.5 py-2.5"
                  style={{
                    borderColor:
                      file.coverage >= 80
                        ? "rgba(34,197,94,0.35)"
                        : file.coverage >= 60
                          ? "rgba(245,158,11,0.35)"
                          : "rgba(239,68,68,0.35)",
                  }}
                >
                  <p className="truncate font-mono text-[11px] text-app-ink">{file.path}</p>
                  <p className="type-metric mt-1.5">{file.coverage}%</p>
                  <p className="type-kicker mt-0.5">
                    lines {file.lines}% · branches {file.branches}%
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelHeader kicker="Criteria" title="Acceptance criteria heatmap" />
            <div className="overflow-x-auto p-4">
              <table className="w-full min-w-[480px] border-collapse text-[12px]">
                <thead>
                  <tr>
                    <th className="p-2 text-left type-kicker">Feature</th>
                    {(heatmap?.criteria ?? []).map((c) => (
                      <th key={c} className="p-2 text-center type-kicker">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(heatmap?.features ?? []).map((feature, row) => (
                    <tr key={feature}>
                      <td className="p-2 text-[12px] text-indigo">{feature}</td>
                      {(heatmap?.cells?.[row] ?? []).map((cell, col) => (
                        <td key={col} className="p-2 text-center">
                          <span
                            className={`inline-block size-3 rounded-full ${HEATMAP_CELL[cell] ?? HEATMAP_CELL.na}`}
                            title={cell}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel>
            <PanelHeader kicker="Failures" title="Failure analysis board" />
            <div className="grid gap-3 p-4 lg:grid-cols-4">
              {(failures?.columns ?? []).map((column) => (
                <div
                  key={column.id}
                  className="rounded-app-sm border border-app-border bg-app-surface-muted/40 p-3"
                >
                  <p className="type-kicker">{column.label}</p>
                  <ul className="mt-2.5 space-y-2">
                    {column.items.map((item) => (
                      <li
                        key={item.id}
                        className="rounded-app-sm border border-app-border bg-app-surface/60 p-2.5 text-[12px]"
                      >
                        <p className="font-medium text-app-ink">{item.testName}</p>
                        <p className="mt-1 text-app-ink-dim">{item.criterion}</p>
                        <p className="mt-1.5 text-danger">{item.error}</p>
                        <p className="mt-1.5 text-app-ink-mute">{item.remediation}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              kicker="Reports"
              title="Pipeline QA reports"
            />
            <ul className="divide-y divide-app-border">
              {(reports?.reports ?? []).length === 0 ? (
                <li className="px-5 py-6 text-[13px] text-app-ink-dim">No pipeline QA reports yet.</li>
              ) : (
                (reports?.reports ?? []).map((report) => (
                  <li key={report.pipelineId}>
                    <button
                      type="button"
                      onClick={() => setSelectedPipelineId(report.pipelineId)}
                      className={`flex w-full items-center justify-between px-5 py-3.5 text-left transition hover:bg-app-surface-muted/30 ${
                        selectedPipelineId === report.pipelineId ? "bg-app-surface-muted/40" : ""
                      }`}
                    >
                      <div>
                        <p className="text-[12px] font-medium text-indigo">{report.jiraKey}</p>
                        <p className="text-[13px] text-app-ink-dim">
                          {report.testCount} test case(s) · pass rate {report.passRate}%
                        </p>
                        {report.testSummary ? (
                          <p className="mt-1 text-[12px] text-app-ink-mute">{report.testSummary}</p>
                        ) : null}
                      </div>
                      <Link
                        to={`/app/pipelines/${report.pipelineId}`}
                        className="text-[13px] text-indigo hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Pipeline →
                      </Link>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </Panel>

          {selectedPipelineId && pipelineReport ? (
            <Panel>
              <PanelHeader
                kicker="Test cases"
                title={pipelineReport.jiraKey ?? selectedPipelineId}
                subtitle={pipelineReport.testSummary}
              />
              <TestCaseViewer testCases={pipelineReport.testCases ?? []} />
            </Panel>
          ) : null}
        </>
      ) : (
        <>
          <Panel>
            <PanelHeader
              kicker="Canary"
              title="Adversarial live-app probes"
              right={
                <button
                  type="button"
                  onClick={handleTriggerCanary}
                  disabled={triggering}
                  className="rounded-full border border-indigo/30 bg-indigo/10 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-indigo transition hover:bg-indigo/20 disabled:opacity-50"
                >
                  {triggering ? "Starting…" : "Run now"}
                </button>
              }
            />
            {triggerMsg ? (
              <p className="border-t border-app-border px-5 py-2 text-[12px] text-app-ink-dim">
                {triggerMsg}
              </p>
            ) : null}
            <ul className="divide-y divide-app-border">
              {runs.length === 0 ? (
                <li className="px-5 py-6 text-[13px] text-app-ink-dim">No canary runs yet.</li>
              ) : (
                runs.map((run) => (
                  <li key={run.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedRunId(run.id)}
                      className={`flex w-full items-start justify-between gap-4 px-5 py-3.5 text-left transition hover:bg-app-surface-muted/30 ${
                        selectedRun?.id === run.id ? "bg-app-surface-muted/40" : ""
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-[12px] font-medium text-indigo">
                          {run.jiraKey ?? run.id}
                          <span className="ml-2 text-app-ink-mute">· {run.trigger}</span>
                        </p>
                        <p className="mt-1 truncate text-[13px] text-app-ink-dim">
                          {run.summary ?? run.error ?? `${run.environment} / ${run.scope}`}
                        </p>
                        <p className="mt-1 text-[11px] text-app-ink-mute">
                          {formatWhen(run.startedAt)} · {run.findingCount ?? run.findings?.length ?? 0}{" "}
                          findings
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          run.status === "COMPLETED"
                            ? "border-success/30 text-success"
                            : run.status === "FAILED"
                              ? "border-danger/30 text-danger"
                              : "border-warning/30 text-warning"
                        }`}
                      >
                        {run.status}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </Panel>

          {selectedRun ? (
            <Panel>
              <PanelHeader
                kicker="Findings"
                title={selectedRun.jiraKey ? `Run for ${selectedRun.jiraKey}` : selectedRun.id}
                subtitle={`${selectedRun.environment} · ${selectedRun.scope} · ${selectedRun.targetUrl}`}
              />
              {(selectedRun.findings ?? []).length === 0 ? (
                <p className="px-5 py-6 text-[13px] text-app-ink-dim">
                  No confirmed findings for this run.
                </p>
              ) : (
                <ul className="divide-y divide-app-border">
                  {selectedRun.findings.map((finding) => (
                    <li key={finding.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            SEVERITY_STYLES[finding.severity] ?? SEVERITY_STYLES.medium
                          }`}
                        >
                          {finding.severity}
                        </span>
                        <span className="type-kicker">{finding.category}</span>
                      </div>
                      <p className="mt-2 text-[14px] font-medium text-app-ink">{finding.title}</p>
                      <p className="mt-1.5 text-[13px] text-app-ink-dim">{finding.description}</p>
                      {finding.reproductionSteps ? (
                        <pre className="mt-3 whitespace-pre-wrap rounded-app-sm border border-app-border bg-app-surface-muted/30 p-3 font-mono text-[11px] text-app-ink-dim">
                          {finding.reproductionSteps}
                        </pre>
                      ) : null}
                      {finding.suggestedFix ? (
                        <p className="mt-2 text-[12px] text-indigo">
                          Suggested fix: {finding.suggestedFix}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          ) : null}
        </>
      )}
      </AgentPageWithChat>
    </AnimatedAppPage>
  );
}
