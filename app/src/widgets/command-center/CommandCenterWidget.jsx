import { Link } from "react-router-dom";
import MetricStrip from "../../shared/components/MetricStrip";
import LiveActivityFeed from "../../shared/components/LiveActivityFeed";
import { useMetricsSummary, useActivityEvents, useCycleTrend } from "../../entities/workspace";
import { useOrgPathBuilder } from "../../shared/providers/OrgRouteProvider";
import { Panel, PanelHeader } from "../../shared/ui/Panel";

export default function CommandCenterWidget() {
  const orgPath = useOrgPathBuilder();
  const { data: metricsData, loading: metricsLoading } = useMetricsSummary({
    pollMs: 8000,
  });
  const { data: eventsData, loading: eventsLoading } = useActivityEvents({
    pollMs: 6000,
  });
  const { data: trendData } = useCycleTrend();

  return (
    <div className="space-y-8">
      <MetricStrip metrics={metricsData?.metrics} loading={metricsLoading} />

      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Panel>
          <PanelHeader
            kicker="Live"
            title="What is happening right now"
          />
          <div className="max-h-[420px] overflow-y-auto px-5 py-4 sm:px-6">
            <LiveActivityFeed events={eventsData?.events} loading={eventsLoading} />
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            kicker="Trend"
            title="Cycle time per feature"
          />
          <div className="px-5 py-6 sm:px-6">
            <CycleTrendChart points={trendData?.points ?? []} />
            <Link
              to={orgPath("costs")}
              className="mt-6 inline-flex text-sm font-medium text-app-ink-dim hover:text-app-ink"
            >
              View cost intelligence →
            </Link>
          </div>
        </Panel>
      </section>
    </div>
  );
}

function CycleTrendChart({ points }) {
  if (!points.length) {
    return <p className="text-sm text-app-ink-dim">No trend data yet.</p>;
  }

  const max = Math.max(...points.map((p) => p.hours));
  const min = Math.min(...points.map((p) => p.hours));
  const range = max - min || 1;
  const width = 100;
  const height = 48;

  const coords = points.map((p, i) => {
    const x = (i / Math.max(points.length - 1, 1)) * width;
    const y = height - ((p.hours - min) / range) * height;
    return `${x},${y}`;
  });

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-32 w-full text-app-accent">
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          points={coords.join(" ")}
        />
      </svg>
      <div className="mt-2 flex justify-between text-xs text-app-ink-mute">
        <span>30 days ago · {max.toFixed(0)}h</span>
        <span>Today · {points[points.length - 1]?.hours?.toFixed(0)}h</span>
      </div>
    </div>
  );
}
