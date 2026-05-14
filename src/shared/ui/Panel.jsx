export function Panel({ children, className = "" }) {
  return (
    <section
      className={`editorial-panel rounded-[1.25rem] border border-hairline/90 bg-surface/50 ${className}`}
    >
      {children}
    </section>
  );
}

export function PanelHeader({ kicker, title, right, body, className = "" }) {
  return (
    <header className={`border-b border-hairline px-5 py-4 sm:px-6 ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {kicker ? <p className="editorial-kicker text-ink-mute">{kicker}</p> : null}
          <h2 className="mt-2 font-display text-[1.45rem] leading-none tracking-tight text-ink sm:text-[1.65rem]">
            {title}
          </h2>
          {body ? (
            <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-ink-dim">
              {body}
            </p>
          ) : null}
        </div>
        {right}
      </div>
    </header>
  );
}

export function PageIntro({ kicker, title, body, right, className = "" }) {
  return (
    <header
      className={`grid gap-4 border-b border-hairline/70 pb-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end ${className}`}
    >
      <div>
        <p className="editorial-kicker text-ink-mute">{kicker}</p>
        <h1 className="mt-3 max-w-4xl font-display text-[2.4rem] leading-[0.94] tracking-[-0.035em] text-ink sm:text-[3.4rem]">
          {title}
        </h1>
        {body ? (
          <p className="editorial-lede mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-dim sm:text-[16px]">
            {body}
          </p>
        ) : null}
      </div>
      {right ? <div className="sm:justify-self-end">{right}</div> : null}
    </header>
  );
}
