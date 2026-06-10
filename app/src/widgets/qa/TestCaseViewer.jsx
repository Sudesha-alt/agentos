const STATUS_STYLES = {
  passed: "border-success/30 bg-success/10 text-success",
  failed: "border-danger/30 bg-danger/10 text-danger",
  blocked: "border-warning/30 bg-warning/10 text-warning",
  skipped: "border-app-border bg-app-surface-muted/40 text-app-ink-dim",
  pending: "border-app-border bg-app-surface-muted/40 text-app-ink-dim",
};

export function TestCaseViewer({ testCases = [], compact = false }) {
  if (!testCases.length) {
    return (
      <p className="px-5 py-4 text-[13px] text-app-ink-dim">No test cases in this report.</p>
    );
  }

  if (compact) {
    return (
      <ul className="divide-y divide-app-border">
        {testCases.map((tc) => (
          <li key={tc.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-app-ink">{tc.title}</p>
              <p className="truncate font-mono text-[11px] text-app-ink-dim">{tc.id}</p>
            </div>
            <StatusBadge status={tc.status} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="divide-y divide-app-border">
      {testCases.map((tc) => (
        <article key={tc.id} className="px-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-mono text-[11px] text-indigo">{tc.id}</p>
              <h4 className="mt-0.5 text-[14px] font-medium text-app-ink">{tc.title}</h4>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {tc.priority ? (
                <span className="type-kicker">{tc.priority}</span>
              ) : null}
              <StatusBadge status={tc.status} />
            </div>
          </div>
          {tc.linkedCriterion || tc.linkedCriteria?.length ? (
            <p className="mt-2 text-[12px] text-app-ink-dim">
              AC: {tc.linkedCriterion ?? tc.linkedCriteria?.join(", ")}
            </p>
          ) : null}
          {tc.steps?.length ? (
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-[13px] text-app-ink-dim">
              {tc.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          ) : null}
          {tc.expectedResult ? (
            <p className="mt-2 text-[12px] text-app-ink">
              <span className="text-app-ink-dim">Expected:</span> {tc.expectedResult}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function StatusBadge({ status }) {
  const key = (status ?? "pending").toLowerCase();
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        STATUS_STYLES[key] ?? STATUS_STYLES.pending
      }`}
    >
      {status ?? "pending"}
    </span>
  );
}
