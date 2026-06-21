import { useState } from "react";
import { handoffStatusLabel, startPmCodingPipeline } from "../../entities/pm-agents";
import { Panel, PanelHeader } from "../../shared/ui/Panel";
import Spinner from "../../app/components/Spinner";

function HandoffBadge({ status }) {
  const label = handoffStatusLabel(status);
  const tone =
    status === "failed"
      ? "border-danger/30 bg-danger/10 text-danger"
      : status === "completed"
        ? "border-success/30 bg-success/10 text-success"
        : "border-indigo/30 bg-indigo/10 text-indigo";
  return (
    <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${tone}`}>
      {label}
    </span>
  );
}

export default function VirinAwaitingAnantaPanel({
  items,
  loading,
  onOpenTicket,
  onHandoffComplete,
}) {
  const [busyKey, setBusyKey] = useState(null);
  const [error, setError] = useState(null);

  async function handleSendToAnanta(jiraKey) {
    setBusyKey(jiraKey);
    setError(null);
    try {
      await startPmCodingPipeline(jiraKey);
      onHandoffComplete?.(jiraKey);
    } catch (err) {
      setError(err.message ?? "Failed to start engineering pipeline");
    } finally {
      setBusyKey(null);
    }
  }

  if (loading && !items?.length) {
    return (
      <Panel>
        <div className="px-5 py-12 sm:px-6">
          <Spinner label="Loading completed work…" />
        </div>
      </Panel>
    );
  }

  if (!items?.length) {
    return (
      <Panel>
        <PanelHeader
          kicker="Handoff queue"
          title="All clear"
          subtitle="Every completed Virin session with a PRD has been sent to Ananta, or none are waiting yet."
        />
      </Panel>
    );
  }

  return (
    <Panel>
      <PanelHeader
        kicker="Handoff queue"
        title="Completed by Virin — not yet with Ananta"
        subtitle="These tickets finished product discovery and have a PRD, but engineering has not started."
      />
      {error ? (
        <p className="border-b border-danger/20 bg-danger/5 px-5 py-3 text-[13px] text-danger sm:px-6">
          {error}
        </p>
      ) : null}
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-[13px]">
          <thead>
            <tr className="border-b border-app-border text-[11px] uppercase tracking-wide text-app-ink-mute">
              <th className="px-5 py-3 font-medium sm:px-6">Ticket</th>
              <th className="px-3 py-3 font-medium">Summary</th>
              <th className="px-3 py-3 font-medium">PRD</th>
              <th className="px-3 py-3 font-medium">Completed</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium sm:px-6">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-app-border/60 last:border-0">
                <td className="px-5 py-3 font-mono text-indigo sm:px-6">{item.jiraKey}</td>
                <td className="max-w-xs truncate px-3 py-3 text-app-ink">{item.summary}</td>
                <td className="px-3 py-3 text-app-ink-dim">{item.prdTitle ?? "—"}</td>
                <td className="whitespace-nowrap px-3 py-3 font-mono text-[11px] text-app-ink-mute">
                  {item.completedAt ? new Date(item.completedAt).toLocaleDateString() : "—"}
                </td>
                <td className="px-3 py-3">
                  <HandoffBadge status={item.engineeringHandoff?.status ?? "not_started"} />
                  {item.engineeringHandoff?.message ? (
                    <p className="mt-1 max-w-[12rem] truncate text-[11px] text-app-ink-mute" title={item.engineeringHandoff.message}>
                      {item.engineeringHandoff.message}
                    </p>
                  ) : null}
                </td>
                <td className="px-5 py-3 sm:px-6">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenTicket?.(item.jiraKey)}
                      className="rounded-app-sm border border-app-border px-3 py-1.5 text-[12px] text-app-ink-dim hover:text-app-ink"
                    >
                      Open in Virin
                    </button>
                    <button
                      type="button"
                      disabled={busyKey === item.jiraKey}
                      onClick={() => handleSendToAnanta(item.jiraKey)}
                      className="app-btn-primary text-[12px] disabled:opacity-50"
                    >
                      {busyKey === item.jiraKey ? "Sending…" : "Send to Ananta"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
