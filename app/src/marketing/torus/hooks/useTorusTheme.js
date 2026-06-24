import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "agentox-marketing-theme";

export function useTorusTheme(rootRef) {
  const [isLight, setIsLight] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored === "light";
    return window.matchMedia("(prefers-color-scheme: light)").matches;
  });

  const applyTheme = useCallback(
    (light) => {
      setIsLight(light);
      localStorage.setItem(STORAGE_KEY, light ? "light" : "dark");
      const root = rootRef.current;
      if (root) {
        root.classList.toggle("torus-light", light);
      }
    },
    [rootRef]
  );

  useEffect(() => {
    applyTheme(isLight);
  }, [applyTheme, isLight]);

  const toggleTheme = useCallback(() => {
    applyTheme(!isLight);
  }, [applyTheme, isLight]);

  return { isLight, toggleTheme };
}
