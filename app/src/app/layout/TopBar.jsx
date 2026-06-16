import { Link } from "react-router-dom";
import NotificationCenter from "../../shared/components/NotificationCenter";
import { useCodebaseCommandPalette } from "../../widgets/codebase-search/useCodebaseCommandPalette";

export default function TopBar() {
  const { openPalette } = useCodebaseCommandPalette();

  return (
    <header className="sticky top-0 z-20 flex h-[4.25rem] items-center gap-3 border-b border-app-border bg-app-surface px-4 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={openPalette}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-app-border bg-app-surface-muted/30 px-4 py-2.5 text-left text-sm text-app-ink-mute transition-colors hover:border-app-ink/12 hover:bg-app-surface hover:text-app-ink-dim"
      >
        <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden className="shrink-0">
          <circle cx="6" cy="6" r="3.5" stroke="currentColor" />
          <path d="M8.5 8.5L12 12" stroke="currentColor" />
        </svg>
        <span className="hidden truncate sm:inline">
          Search tickets, pages, audit events…
        </span>
        <span className="truncate sm:hidden">Search…</span>
        <kbd className="ml-auto hidden shrink-0 rounded-md border border-app-border bg-app-surface px-1.5 py-0.5 text-[10px] font-medium text-app-ink-mute md:inline">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Link
          to="/app/settings"
          className="flex size-10 items-center justify-center rounded-lg border border-app-border bg-app-surface text-app-ink-dim transition-colors hover:border-app-ink/12 hover:text-app-ink md:hidden"
          aria-label="Settings"
        >
          <svg width="18" height="18" viewBox="0 0 14 14" fill="none" aria-hidden>
            <circle cx="7" cy="7" r="2" stroke="currentColor" />
            <path
              d="M7 1.5v1.4M7 11.1v1.4M1.5 7h1.4M11.1 7h1.4M3.2 3.2l1 1M9.8 9.8l1 1M9.8 4.2l1-1M3.2 10.8l1-1"
              stroke="currentColor"
            />
          </svg>
        </Link>
        <NotificationCenter />
      </div>
    </header>
  );
}
