import { Link } from "react-router-dom";
import { formatRelativeTime } from "../../shared/lib/format";
import { Panel, PanelHeader } from "../../shared/ui/Panel";

export default function RecentCompletionsPanel({ items, loading }) {
  return (
    <Panel className="h-full">
      <PanelHeader
        kicker="Momentum"
        title="Recent completions"
      />
      <ul className="divide-y divide-app-border">
        {loading && !items?.length ? (
          <li className="px-5 py-8">
            <div className="h-20 animate-pulse rounded-app-sm bg-app-surface-muted" />
          </li>
        ) : !items?.length ? (
          <li className="px-5 py-8 text-center text-sm text-app-ink-dim">
            No completions yet.
          </li>
        ) : (
          items.map((item) => (
            <li key={item.id}>
              <Link
                to={`/app/pipelines/${item.id}`}
                className="flex items-center justify-between gap-3 px-5 py-4 transition hover:bg-app-surface-muted"
              >
                <div className="min-w-0">
                  <p className="font-mono text-xs text-app-ink-mute">{item.jiraKey}</p>
                  <p className="mt-1 truncate text-sm font-medium text-app-ink">
                    {item.summary}
                  </p>
                  <p className="mt-1 text-xs text-app-ink-mute">
                    {item.completedAt ? formatRelativeTime(item.completedAt) : "—"}
                  </p>
                </div>
                {item.qaPassed ? (
                  <span className="shrink-0 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success">
                    QA pass
                  </span>
                ) : null}
              </Link>
            </li>
          ))
        )}
      </ul>
    </Panel>
  );
}
