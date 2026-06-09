import { useState } from "react";
import { runJiraSync, useJiraSyncStatus } from "../../entities/jira-sync";
import { Panel, PanelHeader } from "../../shared/ui/Panel";
import Spinner from "../../app/components/Spinner";
import { formatRelativeTime } from "../../shared/lib/format";

export default function JiraSyncStatusPanel({ setupSync }) {
  const { data: status, loading, refetch } = useJiraSyncStatus({ pollMs: 6000 });
  const [syncPending, setSyncPending] = useState(false);
  const [message, setMessage] = useState("");

  const sync = status ?? { stats: setupSync?.stats, latestRun: setupSync?.latestRun };
  const stats = sync?.stats;
  const latestRun = sync?.latestRun;
  const running = sync?.running;

  async function handleSync(mode) {
    setSyncPending(true);
    setMessage("");
    try {
      const result = await runJiraSync({ mode });
      setMessage(result.message ?? `${mode} sync started`);
      await refetch();
    } catch (err) {
      setMessage(err.message ?? "Sync failed");
    } finally {
      setSyncPending(false);
    }
  }

  return (
    <Panel>
      <PanelHeader
        title="Ticket sync"
        subtitle="All tickets in configured projects are synced for browsing, PM Agents, and RAG."
        right={
          running ? (
            <span className="font-mono text-[10px] uppercase text-indigo">Syncing…</span>
          ) : null
        }
      />
      <div className="space-y-4 px-5 py-4 sm:px-6">
        {loading && !stats ? <Spinner label="Loading sync status" /> : null}
        {stats ? (
          <dl className="grid gap-3 sm:grid-cols-4">
            <Stat label="Synced tickets" value={stats.total} />
            <Stat label="Embedded (RAG)" value={stats.embedded} />
            <Stat
              label="Last sync"
              value={
                latestRun?.completedAt
                  ? formatRelativeTime(latestRun.completedAt)
                  : latestRun?.startedAt
                    ? `started ${formatRelativeTime(latestRun.startedAt)}`
                    : "—"
              }
            />
            <Stat
              label="Last run"
              value={
                latestRun
                  ? `${latestRun.mode} · ${latestRun.status} · ${latestRun.issuesSynced} synced`
                  : "—"
              }
            />
          </dl>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={syncPending || running}
            onClick={() => handleSync("full")}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {syncPending ? "Starting…" : "Full sync"}
          </button>
          <button
            type="button"
            disabled={syncPending || running}
            onClick={() => handleSync("incremental")}
            className="rounded-lg border border-white/15 px-4 py-2 text-sm disabled:opacity-50"
          >
            Incremental sync
          </button>
        </div>

        {message ? <p className="text-sm text-white/70">{message}</p> : null}
      </div>
    </Panel>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-white/45">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-white">{value}</dd>
    </div>
  );
}
