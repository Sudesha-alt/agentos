import { useEffect } from "react";

export function useLandingAnimations(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return undefined;

    let cleanup;

    Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(
      ([{ default: gsap }, { ScrollTrigger }]) => {
        gsap.registerPlugin(ScrollTrigger);

        const ctx = gsap.context(() => {
          gsap.to("[data-hero-copy]", {
            opacity: 0.92,
            y: -8,
            ease: "power2.out",
            scrollTrigger: {
              trigger: "[data-hero]",
              start: "top top",
              end: "bottom top",
              scrub: 0.5,
            },
          });

          gsap.from("[data-client-metric]", {
            opacity: 0,
            y: 20,
            stagger: 0.1,
            ease: "back.out(1.2)",
            scrollTrigger: { trigger: "[data-clients]", start: "top 75%" },
          });

          gsap.from("[data-final-cta]", {
            opacity: 0,
            y: 16,
            duration: 0.8,
            ease: "power2.out",
            scrollTrigger: { trigger: "[data-final-cta]", start: "top 88%" },
          });
        }, root);

        cleanup = () => ctx.revert();
      }
    );

    return () => cleanup?.();
  }, [rootRef]);
}
