import { useRef, useState } from "react";
import {
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
} from "framer-motion";
import TerminalPanel from "../components/TerminalPanel";
import { pipelineSteps } from "../data/pipelineSteps";
import { EASE } from "../lib/motion";

function StepCard({ step, index, active }) {
  return (
    <motion.div
      animate={{
        opacity: active ? 1 : 0.42,
        scale: active ? 1 : 0.98,
      }}
      transition={{ duration: 0.32, ease: EASE }}
      className={`relative rounded-[1.4rem] border p-5 sm:p-6 transition-colors duration-300 ${
        active
          ? "border-indigo/50 bg-surface shadow-glow-soft"
          : "border-hairline bg-surface/30"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px] text-indigo">
              {step.id}
            </span>
            <span className="mono-caps text-ink-mute">{step.kicker}</span>
          </div>
          <h3 className="mt-4 font-display text-[1.9rem] leading-[0.95] tracking-tight text-ink sm:text-[2.2rem]">
            {step.title}
          </h3>
        </div>
        <span className="rounded-md border border-hairline bg-canvas/50 px-2 py-1 font-mono text-[10px] text-ink-mute">
          {step.badge}
        </span>
      </div>
      <p className="mt-4 max-w-xl text-sm sm:text-[15px] leading-relaxed text-ink-dim">
        {step.description}
      </p>

      {step.checklist && (
        <div className="mt-5 grid gap-2">
          {step.checklist.map((item, i) => (
            <motion.div
              key={item}
              initial={false}
              animate={active ? { opacity: 1, x: 0 } : { opacity: 0.5, x: 0 }}
              transition={{ duration: 0.28, delay: active ? i * 0.08 : 0 }}
              className="flex items-center gap-3 font-mono text-[12px] text-ink-dim"
            >
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <motion.path
                  d="M3.5 7.5L6.2 10.2L11.5 4.8"
                  stroke={active ? "#22C55E" : "#6B6B7B"}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={false}
                  animate={{ pathLength: active ? 1 : 0.2 }}
                  transition={{ duration: 0.45, delay: i * 0.08, ease: EASE }}
                />
              </svg>
              {item}
            </motion.div>
          ))}
        </div>
      )}

      {index < pipelineSteps.length - 1 && (
        <div className="absolute left-8 top-[calc(100%+1px)] hidden h-8 w-px bg-hairline md:block">
          <motion.div
            className="h-full w-px bg-indigo"
            animate={{ scaleY: active ? 1 : 0 }}
            style={{ transformOrigin: "top" }}
            transition={{ duration: 0.55, ease: EASE }}
          />
        </div>
      )}
    </motion.div>
  );
}

export default function Pipeline() {
  const ref = useRef(null);
  const [currentStep, setCurrentStep] = useState(0);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end end"],
  });

  const activeIndex = useTransform(
    scrollYProgress,
    [0, 0.16, 0.33, 0.5, 0.66, 0.83, 1],
    [0, 1, 2, 3, 4, 5, 5],
    { clamp: true }
  );

  useMotionValueEvent(activeIndex, "change", (latest) => {
    const next = Math.max(
      0,
      Math.min(pipelineSteps.length - 1, Math.round(latest))
    );
    setCurrentStep(next);
  });

  return (
    <section
      id="pipeline"
      ref={ref}
      className="relative border-t border-hairline bg-canvas"
      style={{ minHeight: `${pipelineSteps.length * 92}vh` }}
    >
      <div className="sticky top-0 min-h-screen overflow-hidden py-20 sm:py-24">
        <div className="grid-bg absolute inset-0 opacity-50 pointer-events-none radial-mask-center" />

        <div className="relative mx-auto max-w-7xl px-5 sm:px-8">
          <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="mono-caps text-ink-mute">
                // Product demo as system trace
              </p>
              <h2 className="mt-4 max-w-3xl font-display text-display-md tracking-tighter-2 text-ink text-balance">
                One ticket enters. A verified workflow leaves.
              </h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-ink-dim">
              Scroll through the pipeline. The terminal on the right updates as
              each agent takes over.
            </p>
          </div>

          <motion.div
            className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.86fr)] lg:gap-8"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <div className="max-h-[64vh] overflow-hidden pr-1">
              <motion.div
                animate={{ y: -currentStep * 138 }}
                transition={{ duration: 0.55, ease: EASE }}
                className="space-y-4 md:space-y-8"
              >
                {pipelineSteps.map((step, index) => (
                  <motion.div key={step.id}>
                    <StepCard
                      step={step}
                      index={index}
                      active={currentStep === index}
                    />
                  </motion.div>
                ))}
              </motion.div>
            </div>

            <div className="lg:sticky lg:top-28">
              <TerminalPanel step={pipelineSteps[currentStep]} />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
