import { useAuth } from "../../shared/providers/useAuth";

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

export default function SidebarUserCard({ collapsed = false }) {
  const { user, logout } = useAuth();

  if (!user) return null;

  async function handleLogout() {
    await logout();
  }

  if (collapsed) {
    return (
      <div className="border-t border-app-border px-2 py-4">
        <div className="group relative flex justify-center">
          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-full bg-app-charcoal text-xs font-semibold text-white"
            aria-label={user.email}
          >
            {userInitials(user)}
          </button>
          <div className="invisible absolute bottom-full left-1/2 z-50 mb-2 w-48 -translate-x-1/2 rounded-lg border border-app-border bg-app-surface p-2 opacity-0 shadow-app-float transition-all group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
            <p className="truncate px-2 py-1 text-xs text-app-ink-mute">{user.email}</p>
            <button
              type="button"
              onClick={handleLogout}
              className="w-full rounded-md px-2 py-1.5 text-left text-sm text-app-ink-dim hover:bg-app-surface-muted hover:text-app-ink"
            >
              Log out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-app-border px-2 py-3">
      <div className="group relative">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition hover:bg-app-surface-muted/50"
          aria-label="Account menu"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-app-charcoal text-[11px] font-semibold text-white">
            {userInitials(user)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium text-app-ink">
              {user.name?.trim() || user.email?.split("@")[0]}
            </span>
            <span className="block truncate text-[11px] text-app-ink-mute">{user.email}</span>
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden
            className="shrink-0 text-app-ink-mute"
          >
            <path
              d="M4 6l4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div className="invisible absolute bottom-full left-0 right-0 z-50 mb-2 rounded-lg border border-app-border bg-app-surface p-2 opacity-0 shadow-app-float transition-all group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-md px-3 py-2 text-left text-sm text-app-ink-dim hover:bg-app-surface-muted hover:text-app-ink"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
