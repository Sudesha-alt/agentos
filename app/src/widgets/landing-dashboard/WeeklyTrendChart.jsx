import { Panel, PanelHeader } from "../../shared/ui/Panel";

export default function WeeklyTrendChart({ trend, loading }) {
  const points = trend?.points ?? [];
  const summary = trend?.summary;

  if (loading && !points.length) {
    return (
      <Panel>
        <div className="h-48 animate-pulse rounded-app border border-app-border bg-app-surface-muted m-6" />
      </Panel>
    );
  }

  if (!points.length) {
    return (
      <Panel>
        <PanelHeader
          kicker="Trend"
          title="Weekly throughput"
        />
        <p className="px-6 pb-6 text-sm text-app-ink-dim">No trend data yet.</p>
      </Panel>
    );
  }

  const maxY = Math.max(
    ...points.flatMap((p) => [p.featuresCompleted, p.humanInterventions]),
    1
  );
  const width = 100;
  const height = 56;
  const step = width / Math.max(points.length - 1, 1);

  const greenCoords = points.map((p, i) => {
    const x = i * step;
    const y = height - (p.featuresCompleted / maxY) * height;
    return `${x},${y}`;
  });
  const amberCoords = points.map((p, i) => {
    const x = i * step;
    const y = height - (p.humanInterventions / maxY) * height;
    return `${x},${y}`;
  });

  return (
    <Panel>
      <PanelHeader
        kicker="Trend"
        title="Weekly throughput"
      />
      <div className="px-5 py-4 sm:px-6">
        <div className="flex gap-4 text-xs text-app-ink-dim">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-success" /> Features completed / day
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-warning" /> Human interventions / day
          </span>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} className="mt-4 h-40 w-full">
          <polyline
            fill="none"
            stroke="#22c55e"
            strokeWidth="1.8"
            points={greenCoords.join(" ")}
          />
          <polyline
            fill="none"
            stroke="#f59e0b"
            strokeWidth="1.8"
            strokeDasharray="3 2"
            points={amberCoords.join(" ")}
          />
        </svg>
        <div className="mt-2 flex justify-between text-xs text-app-ink-mute">
          <span>{points[0]?.label ?? "14d ago"}</span>
          <span>{points[points.length - 1]?.label ?? "Today"}</span>
        </div>
        {summary ? (
          <p className="mt-6 border-t border-app-border pt-4 text-sm text-app-ink-dim">
            <span className="font-medium text-app-ink">{summary.featuresCompleted}</span>{" "}
            features completed this month · Average cycle time{" "}
            <span className="font-medium text-app-ink">{summary.avgCycleHours}h</span> ·{" "}
            <span className="font-medium text-app-ink">${summary.avgCostPerFeature}</span>{" "}
            average cost per feature
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
