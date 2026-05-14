import { motion } from "framer-motion";
import { EASE } from "../../lib/motion";
import { formatStageLabel, formatUsd } from "../../shared/lib/format";
import StatusPill from "./StatusPill";

export default function StageTimeline({ stages, activeStageId, onSelect }) {
  return (
    <ol className="space-y-1.5">
      {stages.map((stage, i) => {
        const isActive = stage.id === activeStageId;
        return (
          <li key={stage.id}>
            <motion.button
              type="button"
              onClick={() => onSelect?.(stage.id)}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, ease: EASE, delay: i * 0.04 }}
              className={`group relative flex w-full items-center justify-between gap-3 rounded-[1.1rem] border px-4 py-3 text-left transition-colors duration-150 ${
                isActive
                  ? "border-indigo/50 bg-surface shadow-glow-soft"
                  : "border-hairline bg-surface/30 hover:border-hairline-strong"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10.5px] text-ink-mute">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={`text-[13px] ${
                    isActive ? "text-ink" : "text-ink-dim group-hover:text-ink"
                  }`}
                >
                  {formatStageLabel(stage.stage)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {typeof stage.costUsd === "number" && (
                  <span className="hidden font-mono text-[10.5px] text-ink-mute md:inline">
                    {formatUsd(stage.costUsd)}
                  </span>
                )}
                <StatusPill status={stage.status} />
              </div>
            </motion.button>
          </li>
        );
      })}
    </ol>
  );
}
