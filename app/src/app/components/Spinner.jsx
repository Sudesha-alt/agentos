export default function Spinner({ label = "Loading", className = "" }) {
  return (
    <div
      className={`flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.14em] text-app-ink-mute ${className}`}
    >
      <span className="relative inline-flex size-3 items-center justify-center">
        <span className="absolute inline-flex size-3 animate-ping rounded-full bg-indigo/30" />
        <span className="relative inline-flex size-1.5 rounded-full bg-indigo" />
      </span>
      {label}
    </div>
  );
}
