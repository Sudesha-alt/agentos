import { Panel, PanelHeader } from "../../shared/ui/Panel";
import { formatRelativeTime } from "../../shared/lib/format";

export default function AgentHealthPanel({ agents, loading }) {
  return (
    <Panel className="h-full">
      <PanelHeader
        kicker="Calibration"
        title="Agent health"
        body="Leading indicators before review queue pile-ups."
      />
      <div className="grid gap-3 px-5 py-4 sm:grid-cols-1 sm:px-6">
        {loading && !agents?.length
          ? Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-app-sm border border-app-border bg-app-surface-muted"
              />
            ))
          : (agents ?? []).map((agent) => (
              <div
                key={agent.id}
                className="rounded-app-sm border border-app-border bg-app-surface px-4 py-3"
              >
                <p className="text-sm font-semibold text-app-ink">{agent.name}</p>
                <p className="mt-2 text-xs text-app-ink-dim">{agent.primaryMetric}</p>
                <p className="mt-1 text-lg font-medium text-app-ink">{agent.primaryValue}</p>
                <p className="mt-2 text-xs text-app-ink-mute">{agent.secondaryMetric}</p>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-app-ink-mute">
                    Last run:{" "}
                    {agent.lastRunAt ? formatRelativeTime(agent.lastRunAt) : "—"}
                  </span>
                  <span className="flex items-center gap-1.5 font-medium text-success">
                    <span className="size-1.5 rounded-full bg-success" />
                    {agent.status}
                  </span>
                </div>
              </div>
            ))}
      </div>
    </Panel>
  );
}
