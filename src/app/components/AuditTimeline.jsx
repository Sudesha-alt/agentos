import { motion } from "framer-motion";
import { EASE } from "../../lib/motion";
import { formatAuditInline, formatRelativeTime } from "../../shared/lib/format";

const TONE = {
  PIPELINE_STARTED: "text-indigo",
  PIPELINE_COMPLETED: "text-success",
  PIPELINE_FAILED: "text-danger",
  AWAITING_HUMAN: "text-warning",
  HUMAN_OVERRIDE: "text-warning",
};

export default function AuditTimeline({ items }) {
  if (!items?.length)
    return (
      <p className="font-mono text-[12px] text-ink-mute">No audit events yet.</p>
    );

  return (
    <ol className="relative">
      <div className="absolute left-[7px] top-1 bottom-1 w-px bg-hairline" />
      {items.map((entry, i) => (
        <motion.li
          key={i}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.32, ease: EASE, delay: i * 0.03 }}
          className="relative pl-6 pb-4"
        >
          <span className="absolute left-0 top-1.5 size-3.5 rounded-full border border-hairline bg-canvas">
            <span
              className={`absolute left-1 top-1 size-1.5 rounded-full ${
                TONE[entry.event] ? TONE[entry.event].replace("text-", "bg-") : "bg-ink-mute"
              }`}
            />
          </span>
          <div className="flex items-center justify-between gap-3">
            <span className={`font-mono text-[12px] ${TONE[entry.event] ?? "text-ink"}`}>
              {entry.event}
            </span>
            <span className="font-mono text-[10.5px] text-ink-mute">
              {formatRelativeTime(entry.timestamp)}
            </span>
          </div>
          {entry.metadata && Object.keys(entry.metadata).length > 0 && (
            <pre className="mt-1.5 overflow-hidden text-ellipsis font-mono text-[11.5px] leading-relaxed text-ink-dim">
              {formatAuditInline(entry)}
            </pre>
          )}
        </motion.li>
      ))}
    </ol>
  );
}
