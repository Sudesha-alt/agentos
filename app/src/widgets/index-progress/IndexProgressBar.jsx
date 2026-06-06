import { useIndexProgress } from "../../entities/git-integration/useIndexProgress";

export default function IndexProgressBar({
  runId,
  branch,
  enabled = true,
  title = "Indexing codebase",
  className = "",
}) {
  const { loading, active, progress, error } = useIndexProgress({
    runId,
    branch,
    enabled,
  });

  if (!enabled) return null;
  if (loading && !progress) {
    return (
      <div className={`rounded-lg border border-hairline bg-surface-elevated p-4 ${className}`}>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
          Checking index status…
        </p>
      </div>
    );
  }

  if (error && !progress) return null;
  if (!active && !progress) return null;
  if (progress?.done && progress?.status === "completed") {
    return (
      <div className={`rounded-lg border border-success/30 bg-success/5 p-4 ${className}`}>
        <p className="text-sm text-success">
          Index complete — {progress.filesIndexed} new, {progress.filesUpdated} updated
          {progress.filesDeleted ? `, ${progress.filesDeleted} removed` : ""}.
        </p>
      </div>
    );
  }
  if (progress?.done && progress?.status === "failed") {
    return (
      <div className={`rounded-lg border border-danger/30 bg-danger/5 p-4 ${className}`}>
        <p className="text-sm text-danger">
          Index failed{progress.error ? `: ${progress.error}` : "."}
        </p>
      </div>
    );
  }
  if (!active && progress?.status !== "running" && progress?.status !== "queued") {
    return null;
  }

  const percent = progress?.percent ?? 0;
  const processed = progress?.filesProcessed ?? 0;
  const total = progress?.filesTotal;

  return (
    <div className={`rounded-lg border border-hairline bg-surface-elevated p-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
          {title}
        </p>
        <span className="font-mono text-[10px] text-ink-dim">
          {total != null ? `${processed} / ${total}` : `${processed} files`}
          {percent != null ? ` · ${percent}%` : ""}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface">
        <div
          className="h-full rounded-full bg-indigo transition-[width] duration-500 ease-out"
          style={{ width: `${Math.max(percent ?? 5, 5)}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-muted">
        {progress?.status === "queued"
          ? "Queued — waiting for worker…"
          : "Embedding and analyzing files. Visualization updates when complete."}
      </p>
    </div>
  );
}
