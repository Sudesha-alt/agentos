import { Link } from "react-router-dom";
import { formatRelativeTime } from "../../shared/lib/format";
import { Panel, PanelHeader } from "../../shared/ui/Panel";

export default function DashboardLiveActivity({ events, loading }) {
  return (
    <Panel className="h-full">
      <PanelHeader kicker="Live" title="Live activity" />
      <div className="max-h-[360px] overflow-y-auto px-5 py-4 sm:px-6">
        {loading && (!events || events.length === 0) ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-app-sm border border-app-border bg-app-surface-muted"
              />
            ))}
          </div>
        ) : !events?.length ? (
          <p className="py-6 text-center text-sm text-app-ink-dim">No live activity.</p>
        ) : (
          <ul className="space-y-2">
            {events.map((event) => (
              <li key={event.id}>
                <Link
                  to={
                    event.pipelineId
                      ? `/app/pipelines/${event.pipelineId}`
                      : "/app/pipelines"
                  }
                  className="flex items-start gap-3 rounded-app-sm border border-app-border px-3 py-2.5 transition hover:bg-app-surface-muted"
                >
                  <span
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${
                      event.live
                        ? "animate-pulse bg-indigo shadow-[0_0_8px_2px_rgba(99,102,241,0.5)]"
                        : event.tone === "complete"
                          ? "bg-success"
                          : "bg-app-ink-mute"
                    }`}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] text-app-ink">
                      <span className="font-mono text-app-ink-dim">{event.jiraKey}</span>{" "}
                      {event.message}
                    </p>
                    <p className="mt-0.5 text-xs text-app-ink-mute">
                      {formatRelativeTime(event.timestamp)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
