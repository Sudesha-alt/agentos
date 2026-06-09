import { useQaCoverage, useQaHeatmap, useQaFailures, useQaReports } from "../../entities/qa";
import { PageIntro, Panel, PanelHeader } from "../../shared/ui/Panel";
import { Link } from "react-router-dom";
import { AnimatedAppPage } from "../../shared/ui/AnimatedAppPage";

const HEATMAP_CELL = {
  pass: "bg-success",
  warn: "bg-warning",
  fail: "bg-danger",
  na: "bg-ink-mute/30",
};

export default function QaCenter() {
  const { data: coverage } = useQaCoverage();
  const { data: heatmap } = useQaHeatmap();
  const { data: failures } = useQaFailures();
  const { data: reports } = useQaReports();

  return (
    <AnimatedAppPage wide>
      <PageIntro
        kicker="Quality"
        title="Is this safe to ship?"
        body="Coverage maps, criteria heatmaps, failure boards, and structured QA reports."
      />

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
        <PanelHeader
          kicker="Criteria"
          title="Acceptance criteria heatmap"
          body="Patterns across recent features — which criterion types fail repeatedly."
        />
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
            <div key={column.id} className="rounded-app-sm border border-app-border bg-app-surface-muted/40 p-3">
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
        <PanelHeader kicker="Reports" title="QA report viewer" />
        <ul className="divide-y divide-app-border">
          {(reports?.reports ?? []).map((report) => (
            <li key={report.ticketId} className="flex items-center justify-between px-5 py-3.5">
              <div>
                <p className="text-[12px] font-medium text-indigo">{report.ticketId}</p>
                <p className="text-[13px] text-app-ink-dim">
                  Pass rate {report.passRate}% · {report.recommendation.replaceAll("_", " ")}
                </p>
              </div>
              <Link
                to="/app/pipelines?tab=history"
                className="text-[13px] text-indigo hover:underline"
              >
                View pipeline →
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </AnimatedAppPage>
  );
}
