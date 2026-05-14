import { formatStatusLabel } from "../../shared/lib/format";

const STATUS = {
  RUNNING: { dot: "bg-indigo", text: "text-ink" },
  PAUSED: { dot: "bg-warning", text: "text-warning" },
  COMPLETED: { dot: "bg-success", text: "text-success" },
  FAILED: { dot: "bg-danger", text: "text-danger" },
  PENDING: { dot: "bg-ink-mute", text: "text-ink-mute" },
  AWAITING_HUMAN: { dot: "bg-warning", text: "text-warning" },
};

export default function StatusPill({ status, className = "" }) {
  const s = STATUS[status] ?? { dot: "bg-ink-mute", text: "text-ink-mute" };
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-hairline bg-surface/40 px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] ${s.text} ${className}`}
    >
      <span
        className={`size-1.5 rounded-full ${s.dot} ${
          status === "RUNNING" ? "shadow-[0_0_8px_2px_rgba(99,102,241,0.6)]" : ""
        }`}
      />
      {formatStatusLabel(status)}
    </span>
  );
}
