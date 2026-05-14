export function Card({ children, className = "" }) {
  return (
    <div
      className={`rounded-xl border border-hairline bg-surface/40 ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, kicker, right }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-4">
      <div>
        {kicker && (
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-mute">
            {kicker}
          </p>
        )}
        <h3 className="mt-1 text-[15px] font-medium tracking-tight text-ink">
          {title}
        </h3>
      </div>
      {right}
    </div>
  );
}
