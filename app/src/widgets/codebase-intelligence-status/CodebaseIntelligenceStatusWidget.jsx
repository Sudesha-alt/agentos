import { useState } from "react";
import { Link } from "react-router-dom";
import LabelPill from "../../app/components/LabelPill";
import Spinner from "../../app/components/Spinner";
import {
  triggerFullCodebaseIndex,
  useCodebaseLayerStatus,
} from "../../entities/codebase";
import { Panel, PanelHeader } from "../../shared/ui/Panel";

function formatRelativeTime(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return date.toLocaleDateString();
}

function indexStatusLabel(status) {
  switch (status) {
    case "running":
      return "Indexing";
    case "queued":
      return "Queued";
    case "completed":
      return "Complete";
    case "failed":
      return "Failed";
    default:
      return "Not started";
  }
}

function indexStatusTone(status, ready) {
  if (ready) return "success";
  if (status === "running" || status === "queued") return "warning";
  if (status === "failed") return "danger";
  return "muted";
}

export default function CodebaseIntelligenceStatusWidget({
  embedded = false,
  branch,
  showReindex = true,
}) {
  const { data, error, loading, refetch } = useCodebaseLayerStatus({
    branch,
    pollMs: 8000,
  });

  const [reindexing, setReindexing] = useState(false);
  const [reindexMessage, setReindexMessage] = useState(null);

  async function handleReindex() {
    const targetBranch = branch ?? data?.repo?.defaultBranch ?? "main";
    setReindexing(true);
    setReindexMessage(null);
    try {
      const result = await triggerFullCodebaseIndex(targetBranch);
      setReindexMessage(result.message ?? "Full index started.");
      refetch();
    } catch (err) {
      setReindexMessage(err instanceof Error ? err.message : "Re-index failed.");
    } finally {
      setReindexing(false);
    }
  }

  const ready = Boolean(data?.ready);
  const indexStatus = data?.index?.status ?? "none";

  const body = (
    <div className={embedded ? "space-y-4" : "space-y-4 px-5 py-4 sm:px-6"}>
      {loading && !data ? (
        <div className="flex justify-center py-6">
          <Spinner />
        </div>
      ) : error ? (
        <p className="text-[13px] leading-relaxed text-ink-dim">
          Codebase status API unreachable. Start the server with{" "}
          <code className="font-mono text-[12px] text-ink">npm run dev</code> in{" "}
          <code className="font-mono text-[12px] text-ink">server/</code>.
        </p>
      ) : (
        <>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-dim">
            {data?.repo?.fullName
              ? `Repository · ${data.repo.fullName} · ${data.repo.defaultBranch}`
              : "No repository connected"}
          </p>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Files indexed" value={data?.counts?.filesIndexed ?? 0} />
            <Metric label="Embeddings" value={data?.counts?.embeddings ?? 0} />
            <Metric
              label="Graph"
              value={data?.graph?.ready ? "Ready" : "Pending"}
            />
            <Metric
              label="Last indexed"
              value={formatRelativeTime(data?.index?.lastIndexedAt) ?? "—"}
            />
          </dl>

          {!data?.configuration?.openaiConfigured ? (
            <p className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-ink-dim">
              Set <code className="font-mono text-[11px] text-ink">OPENAI_API_KEY</code> for
              embeddings and semantic search.
            </p>
          ) : null}

          {data?.blockers?.length ? (
            <ul className="space-y-1 text-xs text-ink-dim">
              {data.blockers.map((item) => (
                <li key={item}>· {item}</li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap items-center gap-4 text-[13px]">
            {!data?.connected ? (
              <Link
                to="/app/git"
                className="text-ink-dim transition-colors hover:text-indigo"
              >
                Connect GitHub →
              </Link>
            ) : null}
            {showReindex && data?.connected ? (
              <button
                type="button"
                onClick={handleReindex}
                disabled={reindexing || indexStatus === "running" || indexStatus === "queued"}
                className="text-ink-dim transition-colors hover:text-indigo disabled:opacity-50"
              >
                {reindexing ? "Starting re-index…" : "Re-index full repo →"}
              </button>
            ) : null}
            {reindexMessage ? (
              <span className="text-xs text-ink-mute">{reindexMessage}</span>
            ) : null}
          </div>
        </>
      )}
    </div>
  );

  const headerRight = (
    <LabelPill
      label={ready ? "Layer ready" : indexStatusLabel(indexStatus)}
      tone={indexStatusTone(indexStatus, ready)}
    />
  );

  if (embedded) {
    return (
      <div className="rounded-[1rem] border border-hairline bg-surface/30 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
            Codebase layer
          </p>
          {data ? headerRight : null}
        </div>
        {body}
      </div>
    );
  }

  return (
    <Panel>
      <PanelHeader
        kicker="Codebase intelligence"
        title="Layer readiness"
        body="Indexed files, embeddings, and graph status before ticket workflows consume this context."
        right={data ? headerRight : null}
      />
      {body}
    </Panel>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface/40 px-3 py-2">
      <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-mute">
        {label}
      </dt>
      <dd className="mt-1 font-display text-lg text-ink">{value}</dd>
    </div>
  );
}
