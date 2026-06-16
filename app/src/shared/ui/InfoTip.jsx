/**
 * Compact help icon — explanation on hover/focus, not inline copy.
 */
export default function InfoTip({ text, label = "More information", className = "" }) {
  if (!text) return null;

  return (
    <span className={`group/info relative inline-flex shrink-0 align-middle ${className}`}>
      <button
        type="button"
        className="flex size-4 items-center justify-center rounded-full text-app-ink-mute transition hover:bg-app-surface-muted hover:text-app-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo/40"
        aria-label={label}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
          <circle cx="6" cy="6" r="4.25" stroke="currentColor" strokeWidth="1.1" />
          <path
            d="M6 5.25V8.25M6 3.75h.01"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <span
        role="tooltip"
        className="pointer-events-none invisible absolute left-1/2 top-[calc(100%+6px)] z-50 w-64 -translate-x-1/2 rounded-lg border border-app-border bg-app-surface px-3 py-2 text-left text-xs font-normal leading-relaxed text-app-ink-dim opacity-0 shadow-lg transition-opacity group-hover/info:visible group-hover/info:opacity-100 group-focus-within/info:visible group-focus-within/info:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

export function TitleWithInfo({ children, info, infoLabel, className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span>{children}</span>
      {info ? <InfoTip text={info} label={infoLabel} /> : null}
    </span>
  );
}
