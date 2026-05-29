import { motion, AnimatePresence } from "framer-motion";

export default function TourOverlay({
  open,
  step,
  stepIndex,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
  onClose,
}) {
  if (!open || !step) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-30 flex items-end justify-end bg-canvas/40 p-4 backdrop-blur-[2px] sm:p-6"
      >
        <motion.div
          initial={{ x: 24, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="w-full max-w-md rounded-2xl border border-hairline bg-surface/95 p-5 shadow-2xl"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-indigo">
            Guided tour · {stepIndex + 1} / {totalSteps}
          </p>
          <h3 className="mt-2 font-display text-xl text-ink">{step.title}</h3>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-dim">{step.narration}</p>

          {step.quiz ? (
            <p className="mt-4 rounded-lg border border-indigo/30 bg-indigo/5 px-3 py-2 text-[13px] text-ink">
              {step.quiz.prompt}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onPrev}
              disabled={stepIndex === 0}
              className="rounded-full border border-hairline px-4 py-2 text-[13px] disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={onNext}
              className="btn-trace rounded-full bg-indigo/20 px-4 py-2 text-[13px]"
            >
              {stepIndex >= totalSteps - 1 ? "Finish" : "Next"}
            </button>
            <button type="button" onClick={onSkip} className="ml-auto text-[13px] text-ink-mute">
              Skip tour
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mt-3 w-full text-center text-[12px] text-ink-mute hover:text-ink"
          >
            Close
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
