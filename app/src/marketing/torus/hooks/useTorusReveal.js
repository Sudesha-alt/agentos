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
    const connectors = root.querySelectorAll(".connector[id]");
    const navObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            navLinks.forEach((link) => {
              link.classList.toggle("active", link.getAttribute("href") === `#${entry.target.id}`);
            });
          }
        });
      },
      { rootMargin: "-20% 0px -60% 0px" }
    );
    connectors.forEach((el) => navObserver.observe(el));

    return () => {
      revealObserver.disconnect();
      navObserver.disconnect();
    };
  }, [rootRef]);
}
