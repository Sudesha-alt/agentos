import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { EASE, fadeUp, stagger, viewportOnce } from "../lib/motion";

const CONFIRMATION = "Access requested. We'll be in touch shortly.";

export default function EarlyAccess() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [typed, setTyped] = useState("");

  const validEnough = useMemo(() => /\S+@\S+\.\S+/.test(email), [email]);

  useEffect(() => {
    if (!submitted) return;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setTyped(CONFIRMATION.slice(0, i));
      if (i >= CONFIRMATION.length) window.clearInterval(id);
    }, 34);
    return () => window.clearInterval(id);
  }, [submitted]);

  function onSubmit(event) {
    event.preventDefault();
    if (!validEnough) return;
    setTyped("");
    setSubmitted(true);
  }

  return (
    <section
      id="access"
      className="relative flex items-center overflow-hidden border-t border-hairline bg-canvas py-24 sm:py-32"
    >
      <div className="grid-bg absolute inset-0 opacity-50 pointer-events-none radial-mask-center" />
      <div className="absolute left-1/2 top-1/2 size-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo/8 blur-[110px] pointer-events-none" />

      <div className="relative mx-auto w-full max-w-4xl px-5 text-center sm:px-8">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={viewportOnce}
          variants={stagger()}
        >
          <motion.p variants={fadeUp} className="mono-caps text-ink-mute">
            // Early access
          </motion.p>
          <motion.h2
            variants={fadeUp}
            className="mx-auto mt-5 max-w-3xl font-display text-display-lg tracking-tightest text-ink text-balance"
          >
            Built for the engineering team that has wasted one sprint too many.
          </motion.h2>
        </motion.div>

        <div className="mx-auto mt-10 max-w-xl">
          <AnimatePresence mode="wait">
            {!submitted ? (
              <motion.form
                key="form"
                onSubmit={onSubmit}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -8 }}
                viewport={viewportOnce}
                transition={{ duration: 0.55, ease: EASE, delay: 0.12 }}
                className="group relative flex flex-col gap-3 rounded-[1.4rem] border border-hairline bg-surface/50 p-2 sm:flex-row"
              >
                <div className="pointer-events-none absolute inset-0 rounded-[1.4rem] opacity-0 transition-opacity duration-200 group-focus-within:opacity-100">
                  <motion.div
                    className="absolute inset-0 rounded-[1.4rem] border border-indigo"
                    initial={false}
                    animate={{ opacity: [0.6, 1, 0.6] }}
                    transition={{ duration: 2, repeat: Infinity, ease: EASE }}
                  />
                </div>

                <label className="relative flex-1">
                  <span
                    className={`pointer-events-none absolute left-4 text-xs text-ink-mute transition-all duration-200 ${
                      email
                        ? "top-2 font-mono uppercase tracking-[0.14em]"
                        : "top-1/2 -translate-y-1/2"
                    }`}
                  >
                    Work email
                  </span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-14 w-full rounded-[1rem] bg-transparent px-4 pt-4 text-left text-ink outline-none placeholder:text-ink-mute"
                    aria-label="Work email"
                  />
                </label>

                <button
                  type="submit"
                  className="btn-trace rounded-[1rem] border border-hairline-strong bg-ink px-5 py-3 text-sm font-medium text-canvas transition-all duration-100 hover:border-indigo hover:shadow-glow-indigo active:scale-[0.99] disabled:opacity-50"
                >
                  Request access
                </button>
              </motion.form>
            ) : (
              <motion.div
                key="confirmation"
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.55, ease: EASE }}
                className="rounded-[1.4rem] border border-indigo/40 bg-surface/60 px-5 py-7 font-mono text-sm text-ink shadow-glow-soft"
              >
                <span className="caret">{typed}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={viewportOnce}
            transition={{ duration: 0.55, ease: EASE, delay: 0.3 }}
            className="mt-6 text-xs leading-relaxed text-ink-mute"
          >
            Currently onboarding 12 teams. Prioritising Series A and B
            engineering organisations.
          </motion.p>
        </div>
      </div>
    </section>
  );
}
