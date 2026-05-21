import { useMemo, useState } from "react";
import {
  getAiWorkerDebug,
  listAiWorkerIssues,
} from "../../entities/jira-intake";
import { useResource } from "../../shared/lib/useResource";
import EmptyState from "../components/EmptyState";
import Spinner from "../components/Spinner";
import { PageIntro, Panel, PanelHeader } from "../../shared/ui/Panel";

export default function AiWorker() {
  const [showInactive, setShowInactive] = useState(false);
  const activeParam = showInactive ? "0" : "1";

  const {
    data: issuesData,
    error: issuesError,
    loading,
    refetch,
  } = useResource(() => listAiWorkerIssues(activeParam), [activeParam], {
    pollMs: 8000,
  });

  const { data: debugData } = useResource(() => getAiWorkerDebug(), [], {
    pollMs: 15000,
  });

  const items = issuesData?.items ?? [];
  const stats = debugData?.stats;

  const statusLine = useMemo(() => {
    if (issuesError) {
      return "Agentos API unreachable — run npm run dev from d:\\agentos";
    }
    if (debugData?.last) {
      return `Last webhook ${debugData.last.issueKey} · ${formatWhen(debugData.last.receivedAt)}`;
    }
    if ((stats?.active ?? items.length) > 0) {
      return "Queue loaded from local intake database";
    }
    return "Waiting for Jira webhooks (ngrok → :4000/webhooks/jira)";
  }, [issuesError, debugData, stats, items.length]);

  return (
    <div className="mx-auto w-full max-w-[82rem] space-y-6">
      <PageIntro
        kicker="Jira intake"
        title="AI Worker queue"
        body="Tickets in the AI worker board column, captured via webhook and stored by the intake service. Separate from the agent pipeline ledger."
        right={
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-full border border-hairline bg-surface/60 px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-ink-dim transition-colors hover:text-ink"
          >
            Refresh
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <StatusPill label={`${stats?.active ?? (showInactive ? 0 : items.length)} active`} tone="success" />
        {stats?.inactive > 0 ? (
          <StatusPill label={`${stats.inactive} left column`} tone="muted" />
        ) : null}
        <span className="font-mono text-[11px] text-ink-dim">{statusLine}</span>
      </div>

      <label className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-dim">
        <input
          type="checkbox"
          checked={showInactive}
          onChange={(e) => setShowInactive(e.target.checked)}
          className="rounded border-hairline"
        />
        Show only tickets that left AI worker
      </label>

      <Panel>
        <PanelHeader
          kicker="Queue"
          title={showInactive ? "Inactive tickets" : "Active in AI worker"}
          body={
            showInactive
              ? "Issues that moved out of the AI worker column."
              : "Issues currently in the AI worker status on your Jira board."
          }
        />
        <div className="p-5 sm:p-6">
          {loading && !items.length ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : issuesError ? (
            <EmptyState
              title="Intake service offline"
              body="Run npm run dev from the agentos folder (starts API on port 4000), then refresh."
            />
          ) : !items.length ? (
            <EmptyState
              title="No tickets in this view"
              body={
                showInactive
                  ? "No tickets have left the AI worker column yet."
                  : "Move a card into the AI worker column in Jira, or check ngrok and webhook URL."
              }
            />
          ) : (
            <ul className="space-y-3">
              {items.map((issue) => (
                <IssueRow key={issue.issueKey} issue={issue} />
              ))}
            </ul>
          )}
        </div>
      </Panel>
    </div>
  );
}

function IssueRow({ issue }) {
  return (
    <li className="rounded-[1rem] border border-hairline bg-canvas/40 px-4 py-4 transition-colors hover:border-hairline-strong">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[12px] text-indigo">{issue.issueKey}</p>
          <h3 className="mt-1 text-[15px] font-medium text-ink">{issue.summary || "Untitled"}</h3>
          {issue.description ? (
            <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-ink-dim">
              {issue.description}
            </p>
          ) : null}
        </div>
        <StatusPill
          label={issue.active ? issue.status : `${issue.status} · inactive`}
          tone={issue.active ? "success" : "muted"}
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-4 font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-mute">
        {issue.issueType ? <span>{issue.issueType}</span> : null}
        {issue.projectKey ? <span>{issue.projectKey}</span> : null}
        {issue.reporter ? <span>{issue.reporter}</span> : null}
        {issue.lastSeenAt ? <span>Seen {formatWhen(issue.lastSeenAt)}</span> : null}
      </div>
    </li>
  );
}

function StatusPill({ label, tone = "muted" }) {
  const tones = {
    success: "border-success/30 text-success",
    warning: "border-warning/30 text-warning",
    muted: "border-hairline text-ink-dim",
    indigo: "border-indigo/30 text-indigo",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] ${tones[tone] ?? tones.muted}`}
    >
      {label}
    </span>
  );
}

function formatWhen(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
