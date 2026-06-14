import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function useLandingAnimations(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      if (reduced) return;

      gsap.from("[data-hero-notif]", {
        opacity: 0,
        duration: 0.8,
        ease: "power2.out",
        delay: 0.35,
      });

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

    return () => ctx.revert();
  }, [rootRef]);
}
