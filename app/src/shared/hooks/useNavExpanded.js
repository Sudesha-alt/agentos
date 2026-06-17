import { useCallback, useEffect, useState } from "react";
import { appRelativePath } from "../routing/orgPaths";

function autoExpandedFromPath(pathname) {
  const relative = appRelativePath(pathname);
  const ids = [];
  if (relative.startsWith("/pipelines")) ids.push("pipelines");
  if (relative.startsWith("/pm-agents") || relative.startsWith("/roadmap")) {
    ids.push("virin");
  }
  if (relative.startsWith("/ananta")) ids.push("ananta");
  if (relative.startsWith("/qa")) ids.push("neel");
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
