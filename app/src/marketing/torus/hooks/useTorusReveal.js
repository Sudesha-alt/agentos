import { useEffect } from "react";

export function useTorusReveal(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "-80px", threshold: 0 }
    );

    root.querySelectorAll("[data-reveal]").forEach((el) => revealObserver.observe(el));

    const navLinks = root.querySelectorAll(".nav-links a");
    const navTargets = root.querySelectorAll(".connector[id], section[id], [data-pricing]");
    const navObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const targetId =
              entry.target.id ||
              (entry.target.hasAttribute("data-pricing") ? "pricing" : "");
            navLinks.forEach((link) => {
              link.classList.toggle("active", link.getAttribute("href") === `#${targetId}`);
            });
          }
        });
      },
      { rootMargin: "-20% 0px -60% 0px" }
    );
    navTargets.forEach((el) => navObserver.observe(el));

    return () => {
      revealObserver.disconnect();
      navObserver.disconnect();
    };
  }, [rootRef]);
}
