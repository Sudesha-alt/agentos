// Shared motion primitives — keep everything calm, precise, system-thinking.
export const EASE = [0.16, 1, 0.3, 1];

export const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.08, ease: EASE },
  }),
};

export const stagger = (delay = 0.08) => ({
  hidden: {},
  show: {
    transition: { staggerChildren: delay, delayChildren: 0.1 },
  },
});

export const fadeIn = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { duration: 0.6, ease: EASE },
  },
};

export const viewportOnce = { once: true, amount: 0.25 };

/** App shell — subtle page section stagger */
export const pageStagger = (delay = 0.06) => ({
  hidden: {},
  show: {
    transition: { staggerChildren: delay, delayChildren: 0.04 },
  },
});

/** App shell — section fade-in */
export const sectionFadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: EASE },
  },
};

/** Route-level page crossfade (AppShell outlet) */
export const pageRouteFade = {
  hidden: { opacity: 0, y: 6 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: EASE },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: 0.14, ease: EASE },
  },
};

/** App shell — quick-action chips */
export const chipFadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: EASE },
  },
};

/** Tab panel crossfade */
export const tabPanelFade = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2, ease: EASE } },
  exit: { opacity: 0, transition: { duration: 0.15, ease: EASE } },
};

export function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Instant variants when user prefers reduced motion */
export function motionSafe(variants) {
  if (prefersReducedMotion()) {
    return {
      hidden: { opacity: 1, y: 0 },
      show: { opacity: 1, y: 0, transition: { duration: 0 } },
      exit: { opacity: 1, y: 0, transition: { duration: 0 } },
    };
  }
  return variants;
}
