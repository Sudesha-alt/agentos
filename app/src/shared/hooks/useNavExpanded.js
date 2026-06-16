import { useCallback, useEffect, useState } from "react";

function autoExpandedFromPath(pathname) {
  const ids = [];
  if (pathname.startsWith("/app/pipelines")) ids.push("pipelines");
  if (pathname.startsWith("/app/pm-agents") || pathname.startsWith("/app/roadmap")) {
    ids.push("virin");
  }
  if (pathname.startsWith("/app/codebase")) ids.push("ananta");
  if (pathname.startsWith("/app/qa")) ids.push("neel");
  return ids;
}

/** Tracks which sidebar groups are expanded (pipelines + each agent). */
export function useNavExpanded(pathname) {
  const [expanded, setExpanded] = useState(() => new Set(autoExpandedFromPath(pathname)));

  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const id of autoExpandedFromPath(pathname)) {
        next.add(id);
      }
      return next;
    });
  }, [pathname]);

  const toggle = useCallback((id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const isExpanded = useCallback((id) => expanded.has(id), [expanded]);

  return { isExpanded, toggle };
}
