import { formatRelativeTime } from "../../shared/lib/format";

export default function ActivityTimeSlider({ timeline, value, onChange }) {
  if (!timeline?.minDate || !timeline?.maxDate) return null;

  const min = new Date(timeline.minDate).getTime();
  const max = new Date(timeline.maxDate).getTime();
  const current = value ?? max;

  return (
    <div className="rounded-xl border border-hairline bg-surface/30 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
          Activity time scrubber
        </p>
        <p className="font-mono text-[10.5px] text-ink-dim">
          Viewing heat as of {formatRelativeTime(new Date(current).toISOString())}
        </p>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={current}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-3 w-full accent-indigo"
      />
      <div className="mt-1 flex justify-between font-mono text-[10px] text-ink-mute">
        <span>{new Date(min).toLocaleDateString()}</span>
        <span>Today</span>
      </div>
    </div>
  );
}
