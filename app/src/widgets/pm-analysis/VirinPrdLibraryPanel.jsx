import { useState } from "react";
import {
  getPmAnalysis,
  handoffStatusLabel,
  usePmAnalysis,
} from "../../entities/pm-agents";
import { formatScorePercent } from "../../entities/discovery";
import DiscoveryPrdSection from "../discovery/DiscoveryPrdSection";
import { Panel, PanelHeader } from "../../shared/ui/Panel";
import Spinner from "../../app/components/Spinner";

function HandoffBadge({ status }) {
  const label = handoffStatusLabel(status);
  const tone =
    status === "failed"
      ? "border-danger/30 bg-danger/10 text-danger"
      : status === "completed"
        ? "border-success/30 bg-success/10 text-success"
        : status === "running" || status === "enqueued"
          ? "border-warning/30 bg-warning/10 text-warning"
          : "border-app-border bg-app-surface-muted/40 text-app-ink-dim";
  return (
    <span className={`rounded-full border px-2 py-0.5 font-mono text-[10px] ${tone}`}>
      {label}
    </span>
  );
}

function PrdPreviewDrawer({ jiraKey, onClose, onOpenTicket }) {
  const { data: analysis, isValidating } = usePmAnalysis(jiraKey, { pollMs: 0 });

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 p-4 backdrop-blur-sm">
      <div className="flex h-full w-full max-w-2xl flex-col overflow-hidden rounded-app border border-app-border bg-app-surface shadow-app-card">
        <div className="flex items-start justify-between gap-3 border-b border-app-border px-5 py-4 sm:px-6">
          <div>
            <p className="type-kicker text-indigo">PRD preview</p>
            <h3 className="font-mono text-[15px] font-semibold text-app-ink">{jiraKey}</h3>
            {analysis?.generatedPrd?.title ? (
              <p className="mt-1 text-[14px] text-app-ink-dim">{analysis.generatedPrd.title}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => onOpenTicket?.(jiraKey)}
              className="rounded-app-sm border border-app-border px-3 py-1.5 text-[12px] text-app-ink-dim hover:text-app-ink"
            >
              Open ticket
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-app-sm border border-app-border px-3 py-1.5 text-[12px] text-app-ink-dim hover:text-app-ink"
            >
              Close
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {!analysis && isValidating ? (
            <Spinner label="Loading PRD…" />
          ) : analysis?.generatedPrd ? (
            <DiscoveryPrdSection
              parsed={{ generatedPrd: analysis.generatedPrd }}
              scores={
                analysis.generatedPrd.prdConfidence != null
                  ? { prdQualityScore: analysis.generatedPrd.prdConfidence }
                  : null
              }
            />
          ) : (
            <p className="text-[13px] text-app-ink-dim">PRD not available for this ticket.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function VirinPrdLibraryPanel({ items, loading, onOpenTicket }) {
  const [previewKey, setPreviewKey] = useState(null);
  const [prefetchBusy, setPrefetchBusy] = useState(null);

  async function openPreview(jiraKey) {
    setPrefetchBusy(jiraKey);
    try {
      await getPmAnalysis(jiraKey);
      setPreviewKey(jiraKey);
    } finally {
      setPrefetchBusy(null);
    }
  }

  if (loading && !items?.length) {
    return (
      <Panel>
        <div className="px-5 py-12 sm:px-6">
          <Spinner label="Loading PRD library…" />
        </div>
      </Panel>
    );
  }

  if (!items?.length) {
    return (
      <Panel>
        <PanelHeader
          kicker="PRD library"
          title="No PRDs yet"
          subtitle="Complete Virin stage 8 (PRD generation) on a ticket to see it here."
        />
      </Panel>
    );
  }

  return (
    <>
      <Panel>
        <PanelHeader
          kicker="PRD library"
          title="All generated PRDs"
          subtitle="Every product requirements document Virin has produced for your org."
        />
        <div className="grid gap-3 px-5 pb-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-app border border-app-border bg-app-surface-muted/20 p-4 transition hover:border-indigo/30"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-[11px] text-indigo">{item.jiraKey}</span>
                <HandoffBadge status={item.engineeringHandoff?.status ?? "not_started"} />
              </div>
              <h3 className="mt-2 line-clamp-2 text-[14px] font-medium text-app-ink">
                {item.prdTitle ?? item.summary}
              </h3>
              <p className="mt-1 line-clamp-2 text-[12px] text-app-ink-dim">{item.summary}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[10px] text-app-ink-mute">
                {item.prdConfidence != null ? (
                  <span>Quality {formatScorePercent(item.prdConfidence)}</span>
                ) : null}
                {item.completedAt ? (
                  <span>{new Date(item.completedAt).toLocaleDateString()}</span>
                ) : null}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={prefetchBusy === item.jiraKey}
                  onClick={() => openPreview(item.jiraKey)}
                  className="rounded-app-sm border border-app-border px-3 py-1.5 text-[12px] text-app-ink-dim hover:text-app-ink disabled:opacity-50"
                >
                  {prefetchBusy === item.jiraKey ? "Loading…" : "Preview PRD"}
                </button>
                <button
                  type="button"
                  onClick={() => onOpenTicket?.(item.jiraKey)}
                  className="rounded-app-sm border border-indigo/30 bg-indigo/10 px-3 py-1.5 text-[12px] text-indigo hover:bg-indigo/15"
                >
                  Open ticket
                </button>
              </div>
            </article>
          ))}
        </div>
      </Panel>

      {previewKey ? (
        <PrdPreviewDrawer
          jiraKey={previewKey}
          onClose={() => setPreviewKey(null)}
          onOpenTicket={(key) => {
            setPreviewKey(null);
            onOpenTicket?.(key);
          }}
        />
      ) : null}
    </>
  );
}
