import { AnimatePresence, motion } from "framer-motion";
import { EASE } from "../lib/motion";

function lineTone(line) {
  if (line.startsWith("✓")) return "text-success";
  if (line.startsWith("!")) return "text-warning";
  if (line.startsWith("$")) return "text-ink";
  if (line.includes("status")) return "text-indigo";
  return "text-ink-dim";
}

export default function TerminalPanel({ step }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-hairline bg-[#0A0A13]/90 shadow-glow-soft">
      <div className="grid-bg-fine absolute inset-0 opacity-40 pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo/70 to-transparent" />
      <div className="relative flex items-center justify-between border-b border-hairline px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="size-2.5 rounded-full bg-danger/70" />
          <span className="size-2.5 rounded-full bg-warning/80" />
          <span className="size-2.5 rounded-full bg-success/80" />
        </div>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-mute">
          {step.badge}
        </span>
      </div>

      <div className="relative min-h-[300px] p-5 sm:p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={step.id}
            initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
            transition={{ duration: 0.42, ease: EASE }}
            className="font-mono text-[12.5px] sm:text-[13px] leading-7"
          >
            {step.terminal.map((line, i) => (
              <motion.div
                key={`${step.id}-${line}`}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  duration: 0.35,
                  ease: EASE,
                  delay: 0.1 + i * 0.08,
                }}
                className={lineTone(line)}
              >
                <span className="mr-3 select-none text-ink-mute/50">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{line}</span>
                {i === step.terminal.length - 1 && (
                  <span className="caret" aria-hidden="true" />
                )}
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0A0A13] to-transparent" />
      </div>
    </div>
  );
}
