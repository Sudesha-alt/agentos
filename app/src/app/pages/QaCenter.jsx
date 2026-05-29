import { useQaCoverage, useQaHeatmap, useQaFailures, useQaReports } from "../../entities/qa";
import { PageIntro, Panel, PanelHeader } from "../../shared/ui/Panel";
import { Link } from "react-router-dom";

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
    <div className="mx-auto w-full max-w-[82rem] space-y-8">
      <PageIntro
        kicker="Quality"
        title="Is this safe to ship?"
        body="Coverage maps, criteria heatmaps, failure boards, and structured QA reports."
      />

      <Panel>
        <PanelHeader kicker="Coverage" title="Test coverage by file" />
        <div className="grid gap-2 p-5 sm:grid-cols-2">
          {(coverage?.files ?? []).map((file) => (
            <div
              key={file.path}
              className="rounded-xl border border-hairline px-4 py-3"
              style={{
                borderColor:
                  file.coverage >= 80
                    ? "rgba(34,197,94,0.35)"
                    : file.coverage >= 60
                      ? "rgba(245,158,11,0.35)"
                      : "rgba(239,68,68,0.35)",
              }}
            >
              <p className="truncate font-mono text-[11px] text-ink">{file.path}</p>
              <p className="mt-2 font-display text-2xl text-ink">{file.coverage}%</p>
              <p className="font-mono text-[10px] text-ink-mute">
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
        <div className="overflow-x-auto p-5">
          <table className="w-full min-w-[480px] border-collapse text-[12px]">
            <thead>
              <tr>
                <th className="p-2 text-left font-mono text-ink-mute">Feature</th>
                {(heatmap?.criteria ?? []).map((c) => (
                  <th key={c} className="p-2 text-center font-mono text-[10px] text-ink-mute">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(heatmap?.features ?? []).map((feature, row) => (
                <tr key={feature}>
                  <td className="p-2 font-mono text-indigo">{feature}</td>
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
        <div className="grid gap-4 p-5 lg:grid-cols-4">
          {(failures?.columns ?? []).map((column) => (
            <div key={column.id} className="rounded-xl border border-hairline bg-canvas/30 p-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
                {column.label}
              </p>
              <ul className="mt-3 space-y-2">
                {column.items.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-lg border border-hairline bg-surface/40 p-3 text-[12px]"
                  >
                    <p className="font-medium text-ink">{item.testName}</p>
                    <p className="mt-1 text-ink-dim">{item.criterion}</p>
                    <p className="mt-2 text-danger">{item.error}</p>
                    <p className="mt-2 text-ink-mute">{item.remediation}</p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHeader kicker="Reports" title="QA report viewer" />
        <ul className="divide-y divide-hairline">
          {(reports?.reports ?? []).map((report) => (
            <li key={report.ticketId} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="font-mono text-[12px] text-indigo">{report.ticketId}</p>
                <p className="text-[13px] text-ink-dim">
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
    </div>
  );
}
