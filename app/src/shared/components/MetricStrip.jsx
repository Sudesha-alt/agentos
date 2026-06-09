/**
 * Cockpit metrics bar — five numbers, compact type.
 */
export default function MetricStrip({ metrics, loading }) {
  if (loading && !metrics) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-app border border-app-border bg-app-surface-muted"
          />
        ))}
      </div>
    );
  }

  const items = metrics ?? [];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {items.map((metric) => (
        <div
          key={metric.id}
          className="rounded-app border border-app-border bg-app-surface px-4 py-4 shadow-app-card"
        >
          <p className="type-kicker">{metric.label}</p>
          <p className="mt-1.5 type-metric">{metric.value}</p>
          {metric.delta ? (
            <p
              className={`mt-1 text-xs font-medium ${
                metric.deltaPositive ? "text-success" : "text-warning"
              }`}
            >
              {metric.delta}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
