/**
 * Cockpit metrics bar — five numbers, large type, real-time feel.
 */
export default function MetricStrip({ metrics, loading }) {
  if (loading && !metrics) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-[1.25rem] border border-hairline bg-surface/30"
          />
        ))}
      </div>
    );
  }

  const items = metrics ?? [];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {items.map((metric) => (
        <div
          key={metric.id}
          className="rounded-[1.25rem] border border-hairline bg-surface/35 px-5 py-4"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-mute">
            {metric.label}
          </p>
          <p className="mt-2 font-display text-[2.35rem] leading-none tracking-tight text-ink">
            {metric.value}
          </p>
          {metric.delta ? (
            <p
              className={`mt-2 font-mono text-[10.5px] ${
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
