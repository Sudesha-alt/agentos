import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Logo from "./Logo";
import { EASE } from "../lib/motion";

const LINKS = [
  { label: "Pipeline", href: "#pipeline" },
  { label: "Validation", href: "#validation" },
  { label: "Architecture", href: "#architecture" },
  { label: "Integrations", href: "#integrations" },
];

export default function Navigation() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.documentElement.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <>
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE, delay: 0.4 }}
        className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
          scrolled
            ? "bg-canvas/75 backdrop-blur-md border-b border-hairline"
            : "bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Logo />

          <nav className="hidden md:flex items-center gap-8">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="group relative text-[13px] text-ink-dim transition-colors duration-150 hover:text-ink"
              >
                {l.label}
                <span className="absolute -bottom-1 left-0 h-px w-0 bg-ink transition-[width] duration-300 ease-precise group-hover:w-full" />
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-full border border-hairline bg-transparent px-4 py-2 text-[12.5px] text-ink-dim transition-colors hover:border-hairline-strong hover:text-ink"
            >
              Sign in
            </Link>
            <a
              href="#access"
              className="btn-trace inline-flex items-center gap-2 rounded-full border border-hairline-strong bg-surface px-4 py-2 text-[12.5px] text-ink transition-colors hover:border-indigo/50"
            >
              <span className="size-1.5 rounded-full bg-indigo shadow-[0_0_8px_2px_rgba(99,102,241,0.7)]" />
              Request access
            </a>
          </div>

          <button
            aria-label="Toggle menu"
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden inline-flex size-9 items-center justify-center rounded-full border border-hairline text-ink"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="transition-transform"
            >
              <path
                d={menuOpen ? "M3 3 L13 13 M13 3 L3 13" : "M2 5 H14 M2 11 H14"}
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </motion.header>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.4, ease: EASE }}
            className="fixed inset-0 z-40 md:hidden bg-canvas/95 backdrop-blur-xl border-l border-hairline"
          >
            <div className="grid-bg absolute inset-0 opacity-40 pointer-events-none" />
            <div className="relative h-full flex flex-col px-6 pt-24">
              <ul className="space-y-6">
                {LINKS.map((l, i) => (
                  <motion.li
                    key={l.href}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.4,
                      ease: EASE,
                      delay: 0.1 + i * 0.06,
                    }}
                  >
                    <a
                      href={l.href}
                      onClick={() => setMenuOpen(false)}
                    className="block font-display text-[2.2rem] leading-none tracking-tight text-ink"
                    >
                      {l.label}
                    </a>
                  </motion.li>
                ))}
              </ul>
              <div className="mt-auto pb-10">
                <Link
                  to="/login"
                  onClick={() => setMenuOpen(false)}
                  className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-hairline bg-transparent px-4 py-3 text-sm text-ink-dim transition-colors hover:text-ink"
                >
                  Sign in
                </Link>
                <a
                  href="#access"
                  onClick={() => setMenuOpen(false)}
                  className="btn-trace inline-flex w-full items-center justify-center gap-2 rounded-full border border-hairline-strong bg-surface px-4 py-3 text-sm text-ink"
                >
                  Request early access
                </a>
                <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-ink-mute">
                  workflow intelligence layer
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
