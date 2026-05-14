import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ArchitectureDiagram from "../components/ArchitectureDiagram";
import { EASE, fadeUp, stagger, viewportOnce } from "../lib/motion";

const insights = [
  {
    stat: "41%",
    claim:
      "of code is already AI-generated. None of it knows if it matches the original requirement.",
    source: "industry signal",
  },
  {
    stat: "23%",
    claim:
      "of engineering hours are wasted on requirements that were never clear enough to build.",
    source: "sprint waste model",
  },
  {
    stat: "0%",
    claim:
      "of engineering leaders are very confident in AI-generated code in production.",
    source: "production trust gap",
  },
];

export default function IntelligenceLayer() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(
      () => setIndex((v) => (v + 1) % insights.length),
      4000
    );
    return () => window.clearInterval(id);
  }, []);

  const insight = insights[index];

  return (
    <section
      id="architecture"
      className="relative overflow-hidden border-t border-hairline bg-canvas py-24 sm:py-32"
    >
      <div className="grid-bg absolute inset-0 opacity-45 pointer-events-none" />
      <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          variants={stagger()}
          className="mb-14 max-w-3xl"
        >
          <motion.p variants={fadeUp} className="mono-caps text-ink-mute">
            // Intelligence layer
          </motion.p>
          <motion.h2
            variants={fadeUp}
            className="mt-4 font-display text-display-md tracking-tighter-2 text-ink text-balance"
          >
            A stateful orchestration layer between intention, implementation,
            and verification.
          </motion.h2>
        </motion.div>

        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={viewportOnce}
            transition={{ duration: 0.65, ease: EASE }}
          >
            <ArchitectureDiagram />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={viewportOnce}
            transition={{ duration: 0.65, ease: EASE, delay: 0.08 }}
            className="relative min-h-[330px] rounded-[1.5rem] border border-hairline bg-surface/40 p-6 sm:p-8"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo/70 to-transparent" />
            <div className="flex items-center justify-between">
              <p className="mono-caps text-ink-mute">Live thesis</p>
              <div className="flex gap-1.5">
                {insights.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1 w-7 rounded-full transition-colors ${
                      i === index ? "bg-indigo" : "bg-hairline-strong"
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="relative mt-12 [perspective:1200px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={insight.stat}
                  initial={{ opacity: 0, rotateY: -70, y: 8 }}
                  animate={{ opacity: 1, rotateY: 0, y: 0 }}
                  exit={{ opacity: 0, rotateY: 70, y: -8 }}
                  transition={{ duration: 0.65, ease: EASE }}
                  className="[transform-style:preserve-3d]"
                >
                  <div className="font-mono text-6xl tracking-tighter text-indigo">
                    {insight.stat}
                  </div>
                  <p className="mt-6 max-w-md font-display text-[2rem] leading-[1.02] tracking-tight text-ink text-balance">
                    {insight.claim}
                  </p>
                  <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
                    {insight.source}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="absolute bottom-6 left-6 right-6 border-t border-hairline pt-4 font-mono text-[11px] text-ink-mute">
              System memory is the product surface. Agents are execution units.
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
