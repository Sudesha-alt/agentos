export default function DirectoryTree({
  listing,
  loading,
  selectedFile,
  onSelectDirectory,
  onSelectFile,
}) {
  if (loading && !listing) {
    return (
      <div className="px-4 py-6 font-mono text-[11px] text-ink-mute">Loading…</div>
    );
  }

  if (!listing) {
    return (
      <div className="px-4 py-6 font-mono text-[11px] text-ink-mute">No listing</div>
    );
  }

  const hasChildren = listing.directories.length > 0 || listing.files.length > 0;

  if (!hasChildren) {
    return (
      <div className="px-4 py-6 font-mono text-[11px] text-ink-mute">
        Empty directory
      </div>
    );
  }

  return (
    <ul className="divide-y divide-hairline/60">
      {listing.directories.map((dir) => (
        <li key={dir.path}>
          <button
            type="button"
            onClick={() => onSelectDirectory(dir.path)}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left font-mono text-[12px] text-ink transition-colors hover:bg-indigo/5"
          >
            <span className="text-indigo/70" aria-hidden>
              ▸
            </span>
            <span className="min-w-0 flex-1 truncate">{dir.name}/</span>
            <span className="shrink-0 text-[10px] text-ink-mute">{dir.fileCount}</span>
          </button>
        </li>
      ))}
      {listing.files.map((file) => (
        <li key={file.path}>
          <button
            type="button"
            onClick={() => onSelectFile(file.path)}
            className={`flex w-full items-center gap-2 px-4 py-2.5 text-left font-mono text-[12px] transition-colors hover:bg-indigo/5 ${
              selectedFile === file.path
                ? "bg-indigo/10 text-indigo"
                : "text-ink-dim"
            }`}
          >
            <span className="w-3 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{file.name}</span>
            {file.hasSummary ? (
              <span className="shrink-0 text-[9px] uppercase tracking-[0.1em] text-success">
                AI
              </span>
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}
