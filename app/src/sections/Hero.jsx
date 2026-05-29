import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { EASE } from "../lib/motion";
import HeroPipeline from "../components/HeroPipeline";

export default function Hero() {
  return (
    <section
      id="top"
      className="relative isolate w-full overflow-hidden border-b border-hairline"
    >
      <div className="grid-bg absolute inset-0 opacity-100 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)] pointer-events-none" />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -z-10 size-[60vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo/10 blur-[100px]"
      />

      <div className="relative mx-auto flex max-w-7xl flex-col items-center px-5 pb-16 pt-28 sm:px-8 sm:pb-20 sm:pt-32">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.2 }}
          className="flex items-center gap-3"
        >
          <span className="size-1.5 rounded-full bg-indigo shadow-[0_0_10px_2px_rgba(99,102,241,0.8)]" />
          <p className="mono-caps text-ink-dim">
            Workflow intelligence layer
          </p>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.35 }}
          className="mt-7 max-w-[18ch] text-center font-display text-display-xl tracking-tightest text-balance text-ink"
        >
          What Product intends is exactly what Engineering builds.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.5 }}
          className="mt-6 max-w-2xl text-center text-[16px] leading-relaxed text-ink-dim text-pretty sm:text-[17px]"
        >
          The AI layer that lives inside your Jira and makes sure nothing gets
          lost in translation between Product, Engineering, and QA.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: EASE, delay: 0.65 }}
          className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:gap-5"
        >
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-full border border-hairline bg-transparent px-5 py-2.5 text-[13.5px] text-ink-dim transition-colors hover:border-hairline-strong hover:text-ink"
          >
            Open dashboard
          </Link>
          <a
            href="#access"
            className="btn-trace group relative inline-flex items-center gap-3 rounded-full border border-hairline-strong bg-surface px-5 py-2.5 text-[13.5px] text-ink shadow-[0_0_0_1px_rgba(255,255,255,0.02)] transition-all duration-200 hover:border-indigo/60 hover:shadow-glow-indigo"
          >
            <span className="size-1.5 rounded-full bg-indigo shadow-[0_0_10px_2px_rgba(99,102,241,0.8)]" />
            Request early access
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              className="translate-x-0 group-hover:translate-x-0.5 transition-transform duration-200"
            >
              <path
                d="M3 7h8m0 0L7.5 3.5M11 7l-3.5 3.5"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
          </a>
          <a
            href="#pipeline"
            className="group inline-flex items-center gap-2 text-[13px] text-ink-dim hover:text-ink transition-colors"
          >
            See how it works
            <span className="font-mono text-ink-mute group-hover:text-indigo transition-colors">
              ↓
            </span>
          </a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.55 }}
          className="mt-12 w-full sm:mt-14"
        >
          <HeroPipeline />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, ease: EASE, delay: 1.4 }}
          className="mt-10 flex w-full max-w-4xl items-center justify-between border-t border-hairline pt-5 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute"
        >
          <span>System status — operational</span>
          <span className="hidden sm:inline">Avg time-to-spec · 41s</span>
          <span className="hidden md:inline">v0.7.4 · build 1138</span>
        </motion.div>
      </div>
    </section>
  );
}
