import { useCodebaseHealth, useCodebaseHealthTimeline } from "../../entities/codebase";
import Spinner from "../../app/components/Spinner";
import { Panel, PanelHeader } from "../../shared/ui/Panel";

function MetricCard({ label, value, hint }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface/40 px-4 py-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-mute">{label}</p>
      <p className="mt-2 font-display text-2xl text-ink">{value}</p>
      {hint ? <p className="mt-1 text-[12px] text-ink-dim">{hint}</p> : null}
    </div>
  );
}

function TimelineChart({ days }) {
  if (!days?.length) return null;
  const max = Math.max(...days.map((d) => d.totalFiles), 1);

  return (
    <div className="mt-4 flex h-28 items-end gap-0.5">
      {days.map((day) => {
        const agentH = (day.agentFiles / max) * 100;
        const humanH = (day.humanFiles / max) * 100;
        return (
          <div
            key={day.date}
            title={`${day.date}: ${day.totalFiles} files (${day.agentFiles} agent, ${day.humanFiles} human)`}
            className="flex min-w-0 flex-1 flex-col justify-end gap-px"
          >
            <div
              className="w-full rounded-t bg-indigo/70"
              style={{ height: `${agentH}%`, minHeight: day.agentFiles ? 2 : 0 }}
            />
            <div
              className="w-full rounded-t bg-amber-500/70"
              style={{ height: `${humanH}%`, minHeight: day.humanFiles ? 2 : 0 }}
            />
          </div>
        );
      })}
    </div>
  );
}

export default function CodebaseHealthPanel({ branch = "main" }) {
  const { data: health, loading, error } = useCodebaseHealth({ branch });
  const { data: timeline } = useCodebaseHealthTimeline({ branch, days: 30 });

  if (loading && !health) {
    return (
      <Panel>
        <PanelHeader kicker="Health" title="Loading health metrics…" />
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      </Panel>
    );
  }

  if (error && !health) {
    return (
      <Panel>
        <PanelHeader kicker="Health" title="Health unavailable" body={error.message} />
      </Panel>
    );
  }

  const t = health?.totals;

  return (
    <div className="space-y-6">
      <Panel>
        <PanelHeader
          kicker="Health dashboard"
          title="Codebase quality & activity"
          body="Coverage and complexity estimates from indexed files — no raw repo scan."
        />
        <div className="grid gap-4 px-5 py-5 sm:grid-cols-2 lg:grid-cols-3 sm:px-6">
          <MetricCard label="Avg coverage" value={`${t?.avgCoverage ?? 0}%`} />
          <MetricCard label="Zero coverage" value={`${t?.zeroCoveragePct ?? 0}%`} hint="of indexed files" />
          <MetricCard label="Avg complexity" value={t?.avgComplexity ?? 0} />
          <MetricCard label="High complexity" value={t?.highComplexityCount ?? 0} hint="refactor candidates" />
          <MetricCard
            label="Modified (7d)"
            value={t?.modifiedLast7Days?.total ?? 0}
            hint={`${t?.modifiedLast7Days?.agent ?? 0} agent · ${t?.modifiedLast7Days?.human ?? 0} human`}
          />
          <MetricCard label="Tech debt score" value={t?.technicalDebtScore ?? 0} hint="lower is better" />
        </div>
      </Panel>

      <Panel>
        <PanelHeader kicker="Coverage distribution" title="Histogram" />
        <ul className="space-y-2 px-5 py-4 sm:px-6">
          {(health?.coverageHistogram ?? []).map((row) => (
            <li key={row.bucket} className="flex items-center gap-3 text-[13px]">
              <span className="w-16 font-mono text-ink-mute">{row.bucket}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-canvas/80">
                <div
                  className="h-full rounded-full bg-emerald-500/70"
                  style={{
                    width: `${Math.min(100, (row.count / (t?.files || 1)) * 100)}%`,
                  }}
                />
              </div>
              <span className="w-8 text-right text-ink-dim">{row.count}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel>
        <PanelHeader
          kicker="Activity timeline"
          title="30-day commit activity"
          body="Stacked bars: agent (indigo) vs human (amber) file touches per day."
        />
        <div className="px-5 pb-5 sm:px-6">
          <TimelineChart days={timeline?.days} />
        </div>
      </Panel>

      {health?.complexityHotspots?.length ? (
        <Panel>
          <PanelHeader kicker="Hotspots" title="High complexity files" />
          <ul className="divide-y divide-hairline px-5 sm:px-6">
            {health.complexityHotspots.map((file) => (
              <li key={file.path} className="py-3 font-mono text-[12px]">
                <span className="text-indigo">{file.path}</span>
                <span className="ml-3 text-ink-mute">
                  complexity {file.complexity} · coverage {file.coverage}%
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
