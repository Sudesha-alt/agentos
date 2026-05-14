import { motion } from "framer-motion";
import { Panel } from "../../shared/ui/Panel";
import { EASE } from "../../lib/motion";

export default function DashboardOverviewWidget({
  running,
  paused,
  completed,
  failed,
}) {
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-5">
      <Stat label="Running" value={running} tone="indigo" />
      <Stat label="Awaiting human" value={paused} tone="warning" />
      <Stat label="Completed" value={completed} tone="success" />
      <Stat label="Failed" value={failed} tone="danger" />
    </section>
  );
}

function Stat({ label, value, tone }) {
  const dotClass = {
    indigo: "bg-indigo shadow-[0_0_10px_2px_rgba(99,102,241,0.6)]",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
  }[tone];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
    >
      <Panel className="px-5 py-4">
        <div className="flex items-center justify-between">
          <span className="editorial-kicker text-ink-mute">{label}</span>
          <span className={`size-1.5 rounded-full ${dotClass}`} />
        </div>
        <div className="mt-4 font-display text-[2.2rem] leading-none tracking-[-0.04em] text-ink">
          {String(value).padStart(2, "0")}
        </div>
      </Panel>
    </motion.div>
  );
}
