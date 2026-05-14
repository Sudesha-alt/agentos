import { motion } from "framer-motion";
import { EASE } from "../../lib/motion";

export default function ValidationCard({ validation }) {
  if (!validation) return null;

  const score = validation.score ?? 0;
  const passed = validation.passed;

  return (
    <div className="rounded-[1.1rem] border border-hairline bg-surface/40">
      <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
        <div>
          <p className="editorial-kicker text-ink-mute">
            Validation
          </p>
          <h3 className="mt-2 font-display text-[1.35rem] leading-none tracking-tight text-ink">
            {passed ? "Gate passed" : "Gate failed — human review required"}
          </h3>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-ink-mute">Score</span>
          <span
            className={`font-mono text-[14px] ${
              passed ? "text-success" : "text-warning"
            }`}
          >
            {score.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="relative h-1 w-full overflow-hidden rounded-full bg-hairline">
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: score }}
            transition={{ duration: 1, ease: EASE }}
            style={{ transformOrigin: "left" }}
            className={`h-full origin-left ${
              passed ? "bg-success" : "bg-warning"
            }`}
          />
        </div>

        {validation.issues?.length > 0 && (
          <ul className="mt-5 space-y-2">
            {validation.issues.map((iss, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-xl border border-hairline bg-canvas/60 p-3 font-mono text-[12px] text-ink-dim"
              >
                <span
                  className={`mt-0.5 size-1.5 shrink-0 rounded-full ${
                    iss.severity === "error" ? "bg-danger" : "bg-warning"
                  }`}
                />
                <div>
                  <span className="mr-2 text-ink-mute">[{iss.code}]</span>
                  {iss.message}
                </div>
              </li>
            ))}
          </ul>
        )}

        {validation.amberFlags?.length > 0 && (
          <div className="mt-5">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-warning">
              Amber flags
            </p>
            <ul className="mt-2 space-y-1.5">
              {validation.amberFlags.map((f, i) => (
                <li key={i} className="text-[13px] text-ink-dim">
                  · {f}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
