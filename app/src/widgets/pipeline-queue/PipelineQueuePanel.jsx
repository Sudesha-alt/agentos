import { useState } from "react";
import { Link } from "react-router-dom";
import LabelPill from "../../app/components/LabelPill";
import EmptyState from "../../app/components/EmptyState";
import { scanPipelineIntake } from "../../entities/pipeline-jira";
import { useOrgPathBuilder } from "../../shared/providers/OrgRouteProvider";
import { Panel, PanelHeader } from "../../shared/ui/Panel";

function formatIntakeTrigger(intake) {
  if (!intake?.aiWorkerColumnName) return null;
  const statuses = intake.aiWorkerStatuses?.filter(Boolean) ?? [];
  if (statuses.length) {
    return `Column "${intake.aiWorkerColumnName}" → status${statuses.length > 1 ? "es" : ""}: ${statuses.join(", ")}`;
  }
  return `Column "${intake.aiWorkerColumnName}"`;
}

export function PipelineQueueSummary({ setup, className = "" }) {
  const queue = setup?.queue;
  const intake = setup?.intake;
  const activeKey = queue?.activeJiraKey;
  const waiting = queue?.queuedJiraKeys?.length ?? 0;
  const trigger = formatIntakeTrigger(intake);

  if (!setup?.connected) {
    return (
      <p className={`text-[13px] text-ink-dim ${className}`}>Jira not connected</p>
    );
  }

  if (!intake?.aiWorkerColumnName) {
    return (
      <p className={`text-[13px] text-ink-dim ${className}`}>
        Pick an AI Worker intake column to enable pipeline triggers
      </p>
    );
  }

  return (
    <div className={`space-y-2 text-[13px] text-ink-dim ${className}`}>
      {trigger ? (
        <p className="font-mono text-[11px] uppercase tracking-[0.12em]">{trigger}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {activeKey ? (
          <LabelPill label={`Running ${activeKey}`} tone="indigo" />
        ) : (
          <LabelPill label="Idle" tone="muted" />
        )}
        {waiting > 0 ? (
          <LabelPill label={`${waiting} queued`} tone="warning" />
        ) : (
          <LabelPill label="Queue empty" tone="muted" />
        )}
      </div>
    </div>
  );
}

export default function PipelineQueuePanel({ setup, showHeader = true, onRefreshSetup }) {
  const orgPath = useOrgPathBuilder();
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState(null);
  const intake = setup?.intake;
  const queue = setup?.queue ?? {};
  const activeKey = queue.activeJiraKey;
  const queuedKeys = queue.queuedJiraKeys ?? [];
  const trigger = formatIntakeTrigger(intake);
  const isActive = Boolean(activeKey);
  const hasQueue = queuedKeys.length > 0;

  async function handleIntakeScan() {
    setScanning(true);
    setScanMessage(null);
    try {
      const result = await scanPipelineIntake();
      const errors = result.errors?.length ?? 0;
      const skipped = result.skipped ?? 0;
      setScanMessage(
        `Scanned ${result.scanned ?? 0} AI Worker ticket(s), enqueued ${result.enqueued ?? 0}` +
          (skipped ? `, skipped ${skipped}` : "") +
          (errors ? ` (${errors} error${errors === 1 ? "" : "s"})` : "") +
          (result.source ? ` via ${result.source}` : "")
      );
      onRefreshSetup?.();
    } catch (err) {
      setScanMessage(err instanceof Error ? err.message : "Intake scan failed");
    } finally {
      setScanning(false);
    }
  }

  const content = (
    <div className="space-y-5">
      {intake?.aiWorkerColumnName ? (
        <div className="rounded-lg border border-white/10 bg-black/20 px-4 py-3">
          <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-white/45">
            Pipeline trigger
          </p>
          <p className="mt-2 text-sm text-white/90">{trigger}</p>
          <p className="mt-2 text-xs leading-relaxed text-white/50">
            Moving a ticket into this column/status in Jira fires a webhook. Tickets already
            sitting in AI Worker before setup need a scan. Epics and stories decompose into
            subtasks, then enter the FIFO queue below (one run at a time).
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={scanning}
              onClick={handleIntakeScan}
              className="rounded-full border border-violet-400/40 bg-violet-500/15 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-violet-200 hover:bg-violet-500/25 disabled:opacity-50"
            >
              {scanning ? "Scanning…" : "Scan AI Worker now"}
            </button>
            {scanMessage ? (
              <span className="text-xs text-white/60">{scanMessage}</span>
            ) : null}
          </div>
        </div>
      ) : (
        <EmptyState title="Intake not configured" />
      )}

      {intake?.aiWorkerColumnName ? (
        <>
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-white/45">
              Now running
            </p>
            {isActive ? (
              <div className="mt-2 flex flex-wrap items-center gap-3 rounded-lg border border-violet-500/30 bg-violet-500/10 px-4 py-3">
                <span className="font-mono text-base text-violet-200">{activeKey}</span>
                <LabelPill label="Active" tone="indigo" />
                {queue.activeTicketId ? (
                  <span className="text-xs text-white/40">
                    ticket {queue.activeTicketId.slice(0, 8)}…
                  </span>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-sm text-white/50">No pipeline run in progress.</p>
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-white/45">
                Up next ({queuedKeys.length})
              </p>
              <LabelPill
                label={hasQueue ? "FIFO" : "Empty"}
                tone={hasQueue ? "warning" : "muted"}
              />
            </div>
            {hasQueue ? (
              <ol className="mt-2 space-y-2">
                {queuedKeys.map((key, index) => (
                  <li
                    key={`${key}-${index}`}
                    className="flex items-center gap-3 rounded-lg border border-white/10 px-4 py-2.5"
                  >
                    <span className="w-6 font-mono text-xs text-white/35">
                      {index + 1}
                    </span>
                    <span className="font-mono text-sm text-white/85">{key}</span>
                    <span className="ml-auto text-xs text-white/40">waiting</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-2 text-sm text-white/50">
                Queue is empty. Move an epic or story into AI Worker to enqueue subtasks.
              </p>
            )}
          </div>

          <p className="text-xs text-white/45">
            Full run history:{" "}
            <Link to={orgPath("pipelines")} className="text-violet-300 underline">
              Pipelines →
            </Link>
            . Refreshes every few seconds.
          </p>
        </>
      ) : null}
    </div>
  );

  if (!showHeader) {
    return content;
  }

  return (
    <Panel>
      <PanelHeader
        title="Pipeline queue"
        right={
          isActive ? (
            <LabelPill label="Running" tone="indigo" />
          ) : hasQueue ? (
            <LabelPill label={`${queuedKeys.length} waiting`} tone="warning" />
          ) : (
            <LabelPill label="Idle" tone="muted" />
          )
        }
      />
      {content}
    </Panel>
  );
}
