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
  onOpenFile,
  quizFeedback,
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

          {step.spotlights?.length ? (
            <div className="mt-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute">
                Files to read
              </p>
              <ul className="mt-2 space-y-1.5">
                {step.spotlights.map((spot) => (
                  <li key={spot.path}>
                    <button
                      type="button"
                      onClick={() => onOpenFile?.(spot.path)}
                      className="w-full rounded-lg border border-hairline bg-canvas/40 px-3 py-2 text-left hover:border-indigo/40"
                    >
                      <p className="font-mono text-[11px] text-indigo">{spot.path}</p>
                      {spot.summary ? (
                        <p className="mt-1 text-[12px] text-ink-dim">{spot.summary}</p>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {step.quiz ? (
            <div className="mt-4 space-y-2">
              <p className="rounded-lg border border-indigo/30 bg-indigo/5 px-3 py-2 text-[13px] text-ink">
                {step.quiz.prompt}
              </p>
              {!quizFeedback ? (
                <p className="text-[12px] text-ink-mute">Click the correct district on the map.</p>
              ) : null}
              {quizFeedback === "correct" ? (
                <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-200">
                  Correct — {step.quiz.explanation}
                </p>
              ) : null}
              {quizFeedback === "incorrect" ? (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[13px] text-amber-100">
                  Not quite — look for a district starting with{" "}
                  <code className="font-mono text-[12px]">{step.quiz.correctPathPrefix}</code>
                </p>
              ) : null}
            </div>
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
              disabled={Boolean(step.quiz && quizFeedback !== "correct")}
              className="btn-trace rounded-full bg-indigo/20 px-4 py-2 text-[13px] disabled:opacity-40"
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
