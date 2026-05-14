import { motion } from "framer-motion";
import { integrations } from "../components/IntegrationIcons";
import { EASE, fadeUp, stagger, viewportOnce } from "../lib/motion";

export default function Integrations() {
  return (
    <section
      id="integrations"
      className="relative overflow-hidden border-t border-hairline bg-canvas py-24 sm:py-32"
    >
      <div className="absolute inset-0 grid-bg opacity-35 pointer-events-none" />
      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          variants={stagger()}
          className="mx-auto max-w-3xl text-center"
        >
          <motion.p variants={fadeUp} className="mono-caps text-ink-mute">
            // Integration surface
          </motion.p>
          <motion.h2
            variants={fadeUp}
            className="mt-4 font-display text-display-md tracking-tighter-2 text-ink text-balance"
          >
            Lives inside the tools you already use.
          </motion.h2>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          variants={stagger(0.08)}
          className="mx-auto mt-14 grid max-w-4xl grid-cols-2 gap-4 sm:grid-cols-5"
        >
          {integrations.map((item) => (
            <motion.div
              key={item.id}
              variants={fadeUp}
              className="group relative flex flex-col items-center justify-center gap-3 rounded-[1.25rem] border border-hairline bg-surface/30 px-4 py-6 text-ink-dim transition-all duration-100 hover:scale-[1.05] hover:border-indigo/40 hover:text-ink hover:brightness-125"
            >
              <div className="size-10">{item.icon}</div>
              <span className="font-mono text-[11px] uppercase tracking-[0.16em]">
                {item.name}
              </span>
              <div className="pointer-events-none absolute bottom-[calc(100%+10px)] left-1/2 z-10 w-64 -translate-x-1/2 translate-y-1 rounded-md border border-hairline bg-[#0B0B14] p-3 text-center text-xs leading-relaxed text-ink-dim opacity-0 shadow-glow-soft transition-all duration-100 group-hover:translate-y-0 group-hover:opacity-100">
                {item.tooltip}
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={viewportOnce}
          transition={{ duration: 0.55, ease: EASE, delay: 0.2 }}
          className="mx-auto mt-12 max-w-3xl text-center font-mono text-[12px] uppercase tracking-[0.18em] text-ink-dim"
        >
          No migration. No new workflow. Just intelligence added to the one you
          have.
        </motion.p>
      </div>
    </section>
  );
}
