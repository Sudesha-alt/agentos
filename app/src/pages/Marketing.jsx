import { motion } from "framer-motion";
import Navigation from "../components/Navigation";
import { EASE } from "../lib/motion";
import EarlyAccess from "../sections/EarlyAccess";
import Hero from "../sections/Hero";
import Integrations from "../sections/Integrations";
import IntelligenceLayer from "../sections/IntelligenceLayer";
import Pipeline from "../sections/Pipeline";
import Problem from "../sections/Problem";
import ValidationGates from "../sections/ValidationGates";

export default function Marketing() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
      className="min-h-screen bg-canvas text-ink"
    >
      <div className="editorial-noise pointer-events-none fixed inset-0 opacity-[0.2]" />
      <Navigation />
      <main className="relative z-[2]">
        <Hero />
        <Problem />
        <Pipeline />
        <ValidationGates />
        <IntelligenceLayer />
        <Integrations />
        <EarlyAccess />
      </main>
      <footer className="relative z-[2] border-t border-hairline bg-canvas px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute sm:flex-row">
          <span>Agentos · Workflow intelligence layer</span>
          <div className="flex items-center gap-4">
            <a href="/login" className="transition-colors hover:text-ink">
              Sign in
            </a>
            <a href="/login" className="transition-colors hover:text-ink">
              Open app →
            </a>
          </div>
        </div>
      </footer>
    </motion.div>
  );
}
