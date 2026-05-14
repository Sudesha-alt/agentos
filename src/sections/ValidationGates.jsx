import { motion } from "framer-motion";
import { EASE, fadeUp, stagger, viewportOnce } from "../lib/motion";

const gates = [
  {
    title: "PRD Gate",
    label: "Intent integrity",
    items: [
      ["Requirement is testable", "Prevents vague asks from becoming expensive interpretations."],
      ["Actors and permissions explicit", "Stops admin, member, and guest flows from being mixed."],
      ["Dependencies identified", "Prevents blocked engineering work from hiding until build time."],
      ["Edge cases captured", "Catches the scenario Product assumed everyone knew."],
    ],
  },
  {
    title: "Implementation Gate",
    label: "Build alignment",
    items: [
      ["Plan maps to criteria", "Ensures every technical task traces back to Product intent."],
      ["Risk register created", "Surfaces unknowns before code becomes the forcing function."],
      ["State transitions defined", "Prevents partial implementation paths from escaping review."],
      ["Rollback surface clear", "Keeps shipped changes reversible when assumptions fail."],
    ],
  },
  {
    title: "QA Gate",
    label: "Verification mapping",
    items: [
      ["Tests map to ACs", "QA verifies what Product asked for, not only what Engineering built."],
      ["Negative paths included", "Makes failure behavior first-class instead of accidental."],
      ["Regression scope marked", "Avoids retesting everything while still protecting critical flows."],
      ["Human review required", "Keeps judgment in the loop at the moment it matters."],
    ],
  },
];

function Tick({ delay = 0 }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <motion.circle
        cx="8"
        cy="8"
        r="6.5"
        stroke="#1E1E2E"
        strokeWidth="1"
      />
      <motion.path
        d="M4.7 8.2L7 10.4L11.4 5.7"
        stroke="#22C55E"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        whileInView={{ pathLength: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.45, ease: EASE, delay }}
      />
    </svg>
  );
}

export default function ValidationGates() {
  return (
    <section
      id="validation"
      className="relative overflow-hidden border-t border-hairline bg-[#07070E] py-24 sm:py-32"
    >
      <div className="grid-bg absolute inset-0 opacity-40 pointer-events-none" />
      <div className="absolute left-1/2 top-24 size-[38rem] -translate-x-1/2 rounded-full bg-indigo/5 blur-[100px] pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          variants={stagger()}
          className="mx-auto max-w-3xl text-center"
        >
          <motion.p variants={fadeUp} className="mono-caps text-ink-mute">
            // Validation gates
          </motion.p>
          <motion.h2
            variants={fadeUp}
            className="mt-4 font-display text-display-lg tracking-tightest text-ink text-balance"
          >
            We don't just generate. We verify.
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-ink-dim"
          >
            Agent output is only useful when it survives checks designed around
            real handoff failures.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          variants={stagger(0.08)}
          className="mt-14 grid grid-cols-1 gap-5 lg:grid-cols-3"
        >
          {gates.map((gate, gateIndex) => (
            <motion.article
              key={gate.title}
              variants={fadeUp}
              className="group relative rounded-[1.4rem] border border-hairline bg-surface/50 p-5 sm:p-6 hover:border-indigo/40 transition-colors duration-300"
            >
              <motion.div
                className="absolute inset-x-0 top-0 h-px origin-left bg-indigo"
                initial={{ scaleX: 0 }}
                whileInView={{ scaleX: 1 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{
                  duration: 1,
                  ease: EASE,
                  delay: gateIndex * 0.16,
                }}
              />
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display text-[1.8rem] leading-none tracking-tight text-ink">
                    {gate.title}
                  </h3>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
                    {gate.label}
                  </p>
                </div>
                <span className="rounded-full border border-hairline px-2 py-1 font-mono text-[10px] text-success">
                  LIVE
                </span>
              </div>

              <div className="mt-7 space-y-3">
                {gate.items.map(([item, tooltip], i) => (
                  <div
                    key={item}
                    className="group/item relative flex items-center gap-3 rounded-lg border border-transparent px-2 py-2 hover:border-hairline hover:bg-canvas/50 transition-all duration-100"
                  >
                    <Tick delay={gateIndex * 0.12 + i * 0.1} />
                    <span className="font-mono text-[12.5px] text-ink-dim group-hover/item:text-ink transition-colors">
                      {item}
                    </span>
                    <div className="pointer-events-none absolute bottom-[calc(100%+8px)] left-2 z-10 w-64 translate-y-1 rounded-md border border-hairline bg-[#0B0B14] p-3 text-xs leading-relaxed text-ink-dim opacity-0 shadow-glow-soft transition-all duration-100 group-hover/item:translate-y-0 group-hover/item:opacity-100">
                      {tooltip}
                    </div>
                  </div>
                ))}
              </div>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
