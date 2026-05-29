import { Link } from "react-router-dom";
import { formatRelativeTime } from "../lib/format";

const EVENT_TONES = {
  progress: "border-l-indigo bg-indigo/5",
  paused: "border-l-warning bg-warning/5",
  complete: "border-l-success bg-success/5",
  failed: "border-l-danger bg-danger/5",
};

export default function LiveActivityFeed({ events, loading }) {
  if (loading && (!events || events.length === 0)) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-xl border border-hairline bg-surface/20"
          />
        ))}
      </div>
    );
  }

  if (!events?.length) {
    return (
      <p className="py-8 text-center text-sm text-ink-dim">
        No activity yet — pipelines will appear here as they run.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {events.map((event) => (
        <li key={event.id}>
          <Link
            to={event.pipelineId ? `/app/pipelines?selected=${event.pipelineId}` : "/app/pipelines"}
            className={`block rounded-xl border border-hairline border-l-[3px] px-4 py-3 transition-colors hover:bg-surface/50 ${
              EVENT_TONES[event.tone] ?? EVENT_TONES.progress
            }`}
          >
            <p className="text-[13px] text-ink">{event.message}</p>
            <p className="mt-1 font-mono text-[10.5px] text-ink-mute">
              {formatRelativeTime(event.timestamp)}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
