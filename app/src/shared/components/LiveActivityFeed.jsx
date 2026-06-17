import { Link } from "react-router-dom";
import { useOrgPathBuilder } from "../providers/OrgRouteProvider";
import { formatRelativeTime } from "../lib/format";

const EVENT_TONES = {
  progress: "border-l-app-accent bg-app-lavender/30",
  paused: "border-l-warning bg-app-butter/50",
  complete: "border-l-success bg-app-mint/40",
  failed: "border-l-danger bg-danger/5",
};

export default function LiveActivityFeed({ events, loading }) {
  const orgPath = useOrgPathBuilder();
  if (loading && (!events || events.length === 0)) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-app-sm border border-app-border bg-app-surface-muted"
          />
        ))}
      </div>
    );
  }

  if (!events?.length) {
    return (
      <p className="py-8 text-center text-sm text-app-ink-dim">
        No activity yet — pipelines will appear here as they run.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {events.map((event) => (
        <li key={event.id}>
          <Link
            to={
              event.pipelineId
                ? `${orgPath("pipelines")}?selected=${event.pipelineId}`
                : orgPath("pipelines")
            }
            className={`block rounded-app-sm border border-app-border border-l-[3px] px-4 py-3 transition-colors hover:bg-app-surface-muted ${
              EVENT_TONES[event.tone] ?? EVENT_TONES.progress
            }`}
          >
            <p className="text-[13px] text-app-ink">{event.message}</p>
            <p className="mt-1 text-xs text-app-ink-mute">
              {formatRelativeTime(event.timestamp)}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
