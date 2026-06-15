import { Link } from "react-router-dom";
import { DATA_MODE } from "../../shared/config/app";
import { useReadiness } from "../../entities/system";
import { usePipelineList } from "../../entities/pipeline";
import { useAuth } from "../../shared/providers/useAuth";
import ReviewQueueBadge from "../../shared/components/ReviewQueueBadge";
import { useCodebaseCommandPalette } from "../../widgets/codebase-search/useCodebaseCommandPalette";

function userInitials(user) {
  if (!user) return "?";
  if (user.name?.trim()) {
    return user.name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();
  }
  return user.email?.[0]?.toUpperCase() ?? "?";
}

export default function TopBar() {
  const { data } = useReadiness({ pollMs: 15000 });
  const { user, logout } = useAuth();
  const { items: pipelines } = usePipelineList(undefined, { pollMs: 12_000 });
  const reviewCount = pipelines.filter((p) => p.status === "PAUSED").length;
  const { openPalette } = useCodebaseCommandPalette();

  const systemReady = data?.status === "ready" || data?.status === "ok";

  async function handleLogout() {
    await logout();
  }

  return (
    <header className="app-glass sticky top-0 z-20 flex h-[4.25rem] items-center gap-4 border-b border-app-border px-4 sm:px-8 lg:px-10">
      <button
        type="button"
        onClick={openPalette}
        className="flex min-w-0 flex-1 max-w-md items-center gap-3 rounded-full border border-app-border bg-app-surface/80 px-4 py-2.5 text-left text-sm text-app-ink-mute shadow-sm transition-colors hover:border-app-ink/12 hover:text-app-ink-dim"
      >
        <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden className="shrink-0">
          <circle cx="6" cy="6" r="3.5" stroke="currentColor" />
          <path d="M8.5 8.5L12 12" stroke="currentColor" />
        </svg>
        <span className="hidden truncate sm:inline">Search codebase, pipelines…</span>
        <kbd className="ml-auto hidden shrink-0 rounded-md border border-app-border bg-app-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-app-ink-mute sm:inline">
          ⌘K
        </kbd>
      </button>

      <div className="flex items-center gap-2 sm:gap-3">
        <ReviewQueueBadge count={reviewCount} className="hidden sm:inline-flex" />
        <span
          className={`hidden items-center gap-2 rounded-full border border-app-border bg-app-surface px-3 py-1.5 text-[11px] font-medium sm:inline-flex ${
            DATA_MODE === "mock" ? "text-warning" : "text-success"
          }`}
        >
          <span
            className={`size-1.5 rounded-full ${
              DATA_MODE === "mock" ? "bg-warning" : "bg-success"
            }`}
          />
          {DATA_MODE === "mock" ? "Mock" : "Live"}
        </span>
        <span
          className={`hidden items-center gap-2 rounded-full border border-app-border bg-app-surface px-3 py-1.5 text-[11px] font-medium lg:inline-flex ${
            systemReady ? "text-success" : "text-warning"
          }`}
        >
          <span className={`size-1.5 rounded-full ${systemReady ? "bg-success" : "bg-warning"}`} />
          {data?.status ?? "checking"}
        </span>

        <Link
          to="/app/settings"
          className="flex size-10 items-center justify-center rounded-full border border-app-border bg-app-surface text-app-ink-dim transition-colors hover:border-app-ink/12 hover:text-app-ink"
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

        {user ? (
          <div className="relative group">
            <button
              type="button"
              className="flex size-10 items-center justify-center rounded-full bg-app-charcoal text-sm font-semibold text-white shadow-sm"
              aria-label={user.email}
            >
              {userInitials(user)}
            </button>
            <div className="invisible absolute right-0 top-full z-50 mt-2 w-52 rounded-app border border-app-border bg-app-surface p-2 opacity-0 shadow-app-float transition-all group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
              <p className="truncate px-2 py-1.5 text-xs text-app-ink-mute">{user.email}</p>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full rounded-full px-3 py-2 text-left text-sm text-app-ink-dim transition-colors hover:bg-app-surface-muted hover:text-app-ink"
              >
                Log out
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
