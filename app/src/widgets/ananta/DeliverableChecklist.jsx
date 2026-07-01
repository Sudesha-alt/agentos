import { buildGitHubBlobUrl } from "./githubLinks";

export default function DeliverableChecklist({
  deliverableFiles,
  stagedFiles,
  isFailed,
  githubRepo,
  implementationBranch,
  onSelectFile,
  selectedPath,
  hero = false,
}) {
  if (!deliverableFiles?.length) return null;

  const stagedPaths = new Set((stagedFiles ?? []).map((f) => f.path));
  const allStaged = deliverableFiles.every((file) => stagedPaths.has(file.path));

  return (
    <div
      className={
        hero
          ? "rounded-app-sm border border-warning/30 bg-warning/5 px-4 py-4 sm:px-5"
          : "rounded-app-sm border border-warning/25 bg-warning/5 px-3 py-2"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-app-ink-mute">
            Required deliverable files
          </p>
          <p className="mt-1 text-[12px] text-app-ink-dim">
            {allStaged
              ? "All PRD deliverables are staged on the implementation branch."
              : "Ananta must write each path exactly as listed in the PRD."}
          </p>
        </div>
        {allStaged ? (
          <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-success">
            Complete
          </span>
        ) : isFailed ? (
          <span className="rounded-full bg-danger/15 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-danger">
            Incomplete
          </span>
        ) : null}
      </div>
      <ul className={`space-y-2 ${hero ? "mt-4" : "mt-2"}`}>
        {deliverableFiles.map((file) => {
          const staged = stagedPaths.has(file.path);
          const githubUrl = buildGitHubBlobUrl(githubRepo, implementationBranch, file.path);
          const active = selectedPath === file.path;
          return (
            <li
              key={file.path}
              className={`rounded-app-sm border px-3 py-2.5 ${
                active ? "border-indigo/40 bg-indigo/5" : "border-app-border/60 bg-app-surface/40"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onSelectFile?.(file.path)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p
                    className={`font-mono text-[12px] ${staged ? "text-success" : isFailed ? "text-danger" : "text-app-ink"}`}
                  >
                    {staged ? "✓" : "○"} {file.path}
                  </p>
                  {file.purpose ? (
                    <p className="mt-1 text-[12px] text-app-ink-dim">{file.purpose}</p>
                  ) : null}
                </button>
                {githubUrl ? (
                  <a
                    href={githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-[11px] font-medium text-indigo hover:underline"
                  >
                    GitHub ↗
                  </a>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
