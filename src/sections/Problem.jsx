import { motion } from "framer-motion";
import { EASE, stagger, fadeUp, viewportOnce } from "../lib/motion";

const FAILURES = [
  {
    tag: "FAIL_01",
    title: "The PRD that meant three different things to three different engineers.",
    a: "Ambiguity compounds at every handoff.",
    b: "By sprint review, nobody remembers what the spec actually said.",
  },
  {
    tag: "FAIL_02",
    title: "The sprint that built the wrong feature perfectly.",
    a: "Implementation was flawless. Intent was missed.",
    b: "Two weeks, four engineers, and a roadmap card that has to be rewritten.",
  },
  {
    tag: "FAIL_03",
    title: "The QA pass that missed what Product actually asked for.",
    a: "Tests cover what was built, not what was wanted.",
    b: "Regression is green. The user story still fails.",
  },
];

export default function Problem() {
  return (
    <section
      id="problem"
      className="relative w-full overflow-hidden border-t border-hairline bg-canvas py-24 sm:py-32"
    >
      <div className="grid-bg absolute inset-0 opacity-50 pointer-events-none [mask-image:linear-gradient(to_bottom,transparent,black_20%,black_80%,transparent)]" />

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          variants={stagger(0.08)}
          className="mb-14 flex flex-col gap-4 sm:gap-5"
        >
          <motion.p
            variants={fadeUp}
            className="mono-caps text-ink-mute"
          >
            // Three failures we built this to prevent
          </motion.p>
          <motion.h2
            variants={fadeUp}
            className="max-w-3xl font-display text-display-md tracking-tighter-2 text-ink text-balance"
          >
            Software teams don't ship the wrong thing because they're lazy. They
            ship it because the spec already lost.
          </motion.h2>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          variants={stagger(0.1)}
          className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6"
        >
          {FAILURES.map((f) => (
            <motion.article
              key={f.tag}
              variants={fadeUp}
              whileHover={{ y: -2 }}
              transition={{ duration: 0.3, ease: EASE }}
              className="group relative flex flex-col rounded-[1.4rem] border border-hairline bg-surface/40 p-6 sm:p-7 transition-colors duration-300 hover:border-indigo/40 hover:shadow-glow-soft"
            >
              <div className="pointer-events-none absolute inset-0 rounded-[1.4rem] opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.07),transparent_60%)]" />

              <div className="relative flex items-center justify-between">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink-mute">
                  {f.tag}
                </span>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-danger/70">
                  post-mortem
                </span>
              </div>

              <h3 className="relative mt-7 max-w-[26ch] font-display text-[1.85rem] leading-[0.95] tracking-tight text-ink text-balance">
                {f.title}
              </h3>

              <div className="relative mt-7 border-t border-hairline pt-5 text-[13.5px] leading-relaxed text-ink-dim space-y-2">
                <p>{f.a}</p>
                <p>{f.b}</p>
              </div>

              <div className="relative mt-7 flex items-center gap-2 font-mono text-[11px] text-ink-mute">
                <span className="inline-block h-px w-6 bg-indigo/60" />
                <span>handoff failure</span>
              </div>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
