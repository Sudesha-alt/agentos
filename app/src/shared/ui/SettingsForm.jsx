import { TitleWithInfo } from "./InfoTip";

/**
 * Untitled UI–style settings section primitives: label column left, controls right.
 */
export function SettingsSection({ title, info, children, className = "" }) {
  return (
    <section className={`border-b border-app-border py-6 last:border-b-0 last:pb-0 ${className}`}>
      {title ? (
        <div className="mb-6">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-app-ink">
            <TitleWithInfo info={info}>{title}</TitleWithInfo>
          </h2>
        </div>
      ) : null}
      <div className="space-y-0">{children}</div>
    </section>
  );
}

export function SettingsRow({ label, info, children, className = "" }) {
  return (
    <div
      className={`grid grid-cols-1 gap-4 border-t border-app-border py-5 first:border-t-0 first:pt-0 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:gap-8 ${className}`}
    >
      <div className="max-w-sm">
        {label ? (
          <p className="flex items-center gap-1.5 text-sm font-medium text-app-ink">
            <TitleWithInfo info={info}>{label}</TitleWithInfo>
          </p>
        ) : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function SettingsFormFooter({ onCancel, onSave, saveLabel = "Save changes", pending = false, disabled = false }) {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-app-border pt-6">
      {onCancel ? (
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="rounded-lg border border-app-border bg-app-surface px-4 py-2.5 text-sm font-medium text-app-ink-dim transition hover:bg-app-surface-muted hover:text-app-ink disabled:opacity-50"
        >
          Cancel
        </button>
      ) : null}
      <button
        type="button"
        onClick={onSave}
        disabled={pending || disabled}
        className="rounded-lg bg-indigo px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo/90 disabled:opacity-50"
      >
        {pending ? "Saving…" : saveLabel}
      </button>
    </div>
  );
}
