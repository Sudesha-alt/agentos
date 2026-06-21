import LabelPill from "../../app/components/LabelPill";
import Spinner from "../../app/components/Spinner";
import { formatRelativeTime } from "../../shared/lib/format";

function resolveIndexState({
  indexing,
  syncRunning,
  referenceConfigured,
  stats,
  lastIndexResult,
}) {
  if (indexing) {
    return {
      tone: "indigo",
      label: "Indexing…",
      detail: "Embedding reference tickets into pgvector. This may take a minute.",
    };
  }

  if (syncRunning) {
    return {
      tone: "indigo",
      label: "Sync running",
      detail: "Jira ticket sync is in progress. Index stats refresh when it finishes.",
    };
  }

  if (!referenceConfigured) {
    return {
      tone: "muted",
      label: "Not configured",
      detail: "Save reference columns above, then run Index Jira vectors.",
    };
  }

  const total = stats?.total ?? 0;
  const embedded = stats?.embedded ?? 0;
  const pct = total > 0 ? Math.round((embedded / total) * 100) : 0;

  if (total === 0) {
    return {
      tone: "muted",
      label: "No tickets",
      detail: "No synced tickets yet. Run a full sync or save reference columns.",
    };
  }

  if (embedded === 0) {
    return {
      tone: "warning",
      label: "Not indexed",
      detail: `${total} synced ticket(s) — none embedded yet. Click Index Jira vectors.`,
    };
  }

  if (lastIndexResult?.completedAt) {
    const when = formatRelativeTime(lastIndexResult.completedAt);
    const summary = `${lastIndexResult.embedded} embedded, ${lastIndexResult.skipped} unchanged${lastIndexResult.synced ? `, ${lastIndexResult.synced} synced` : ""}`;
    if (lastIndexResult.errors > 0) {
      return {
        tone: "warning",
        label: "Index finished",
        detail: `Last run ${when} with ${lastIndexResult.errors} error(s): ${summary}.`,
      };
    }
    return {
      tone: "success",
      label: "Index complete",
      detail: `Last run ${when}: ${summary}.`,
    };
  }

  if (embedded < total) {
    return {
      tone: "warning",
      label: "Partially indexed",
      detail: `${embedded} of ${total} tickets embedded (${pct}%). Re-run index for new or changed tickets.`,
    };
  }

  return {
    tone: "success",
    label: "Up to date",
    detail: `All ${embedded} synced ticket(s) are embedded (${pct}%).`,
  };
}

export default function JiraVectorIndexStatus({
  indexing = false,
  syncRunning = false,
  referenceConfigured = false,
  stats,
  lastIndexResult,
  compact = false,
}) {
  const total = stats?.total ?? 0;
  const embedded = stats?.embedded ?? 0;
  const pct = total > 0 ? Math.round((embedded / total) * 100) : 0;
  const state = resolveIndexState({
    indexing,
    syncRunning,
    referenceConfigured,
    stats,
    lastIndexResult,
  });

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {indexing ? <Spinner label="" className="!py-0" /> : null}
        <LabelPill label={state.label} tone={state.tone} />
      </div>
    );
  }

  return (
    <div className="rounded-app-sm border border-app-border bg-app-surface-muted/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {indexing ? <Spinner label="" className="!py-0" /> : null}
          <LabelPill label={state.label} tone={state.tone} />
        </div>
        {total > 0 ? (
          <p className="font-mono text-[11px] text-app-ink-mute">
            {embedded} / {total} embedded · {pct}%
          </p>
        ) : null}
      </div>

      {total > 0 ? (
        <div
          className="mt-3 h-2 overflow-hidden rounded-full bg-app-border/60"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Jira vector embed progress"
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              pct >= 100 ? "bg-success" : pct > 0 ? "bg-indigo" : "bg-app-border"
            }`}
            style={{ width: `${Math.max(indexing && pct === 0 ? 8 : 0, pct)}%` }}
          />
        </div>
      ) : null}

      <p className="mt-3 text-[13px] leading-relaxed text-app-ink-dim">{state.detail}</p>
    </div>
  );
}
