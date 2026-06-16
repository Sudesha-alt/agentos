/**
 * Shared tab pill for app pages (light theme).
 */
export function AppTabButton({ active, onClick, children, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] transition-all ${
        active
          ? "bg-app-charcoal text-white shadow-app-nav-active"
          : "border border-app-border bg-app-surface text-app-ink-dim hover:border-app-ink/12 hover:text-app-ink"
      } ${className}`}
    >
      {children}
    </button>
  );
}

/**
 * Standard page container for /app routes.
 */
export function AppPage({ children, className = "", wide = false }) {
  const hasMaxWidth = /\bmax-w-/.test(className);
  const widthClass = hasMaxWidth ? "" : wide ? "max-w-[96rem]" : "max-w-[82rem]";
  return (
    <div
      className={`mx-auto w-full min-w-0 space-y-5 ${widthClass} ${className}`}
    >
      {children}
    </div>
  );
}
