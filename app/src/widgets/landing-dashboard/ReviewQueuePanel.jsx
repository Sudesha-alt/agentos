import { Link } from "react-router-dom";
import { Panel, PanelHeader } from "../../shared/ui/Panel";

const BORDER = {
  critical: "border-l-danger",
  warning: "border-l-warning",
};

export default function ReviewQueuePanel({ items, loading }) {
  const hasItems = items?.length > 0;

  return (
    <Panel className="h-full border-warning/20 shadow-app-card">
      <PanelHeader
        kicker="Action required"
        title={`Needs your review${hasItems ? ` (${items.length})` : ""}`}
      />
      <div className="px-5 py-4 sm:px-6">
        {loading && !hasItems ? (
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-app-sm border border-app-border bg-app-surface-muted"
              />
            ))}
          </div>
        ) : !hasItems ? (
          <div className="rounded-app-sm border border-success/30 bg-success/10 px-5 py-8 text-center">
            <p className="text-sm font-medium text-success">
              Nothing needs your attention right now.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li
                key={item.id}
                className={`rounded-app-sm border border-app-border border-l-[4px] bg-app-surface px-4 py-4 ${
                  BORDER[item.severity] ?? BORDER.warning
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-medium text-app-ink-dim">
                      {item.severity === "critical" ? "🔴" : "🟡"}{" "}
                      {item.jiraKey}
                    </p>
                    <p className="mt-1 truncate text-[15px] font-medium text-app-ink">
                      {item.summary}
                    </p>
                    <p className="mt-1 text-sm text-app-ink-dim">{item.reason}</p>
                    <p className="mt-1 text-xs text-app-ink-mute">
                      Waiting {item.waitingMinutes} minute
                      {item.waitingMinutes === 1 ? "" : "s"}
                    </p>
                  </div>
                  <Link
                    to={item.actionTo}
                    className="shrink-0 rounded-full border border-app-border bg-app-surface px-4 py-2 text-sm font-medium text-app-ink shadow-app-card transition hover:border-indigo/40 hover:bg-indigo/5"
                  >
                    {item.actionLabel}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
