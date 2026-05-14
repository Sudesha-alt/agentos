export default function EmptyState({ title, body, action }) {
  return (
    <div className="rounded-xl border border-dashed border-hairline-strong bg-surface/30 px-6 py-10 text-center">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-mute">
        // empty
      </p>
      <h3 className="mt-2 text-base text-ink">{title}</h3>
      {body && (
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-ink-dim">
          {body}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
