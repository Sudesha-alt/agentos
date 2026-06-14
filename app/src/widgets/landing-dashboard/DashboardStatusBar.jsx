import { Link } from "react-router-dom";

const TONE_STYLES = {
  running: "hover:border-indigo/40 hover:bg-indigo/5",
  review: "text-warning hover:border-warning/50 hover:bg-warning/10",
  success: "text-success hover:border-success/40 hover:bg-success/10",
  neutral: "hover:border-app-border-strong",
};

/**
 * Five large linked numbers — cockpit status bar.
 */
export default function DashboardStatusBar({ metrics, loading }) {
  if (loading && !metrics?.length) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-[4.5rem] animate-pulse rounded-app border border-app-border bg-app-surface-muted"
          />
        ))}
      </div>
    );
  }

  const items = metrics ?? [];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {items.map((metric) => {
        const tone = TONE_STYLES[metric.tone] ?? TONE_STYLES.neutral;
        const inner = (
          <>
            <p
              className={`font-display text-[2rem] leading-none tracking-tight sm:text-[2.25rem] ${
                metric.tone === "review" ? "text-warning" : "text-app-ink"
              }`}
            >
              {metric.value}
            </p>
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-app-ink-mute">
              {metric.label}
            </p>
          </>
        );

        if (metric.href) {
          return (
            <Link
              key={metric.id}
              to={metric.href}
              className={`rounded-app border border-app-border bg-app-surface px-4 py-4 shadow-app-card transition ${tone}`}
            >
              {inner}
            </Link>
          );
        }

        return (
          <div
            key={metric.id}
            className={`rounded-app border border-app-border bg-app-surface px-4 py-4 shadow-app-card ${tone}`}
          >
            {inner}
          </div>
        );
      })}
    </div>
  );
}
