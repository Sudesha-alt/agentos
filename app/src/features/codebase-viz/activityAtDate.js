const MS_DAY = 86_400_000;

/** Heat as of a scrubbed point in time (uses lastModified proximity). */
export function activityColorAtDate(lastModified, asOfMs, agentOverlay, lastModifiedBy) {
  if (agentOverlay && lastModifiedBy === "agent") {
    return { fill: "rgba(168, 85, 247, 0.85)", stroke: "#c084fc", pulse: true };
  }
  if (!lastModified) {
    return { fill: "rgba(30, 58, 138, 0.55)", stroke: "#1e3a8a" };
  }

  const mod = new Date(lastModified).getTime();
  const delta = asOfMs - mod;

  if (delta < 0) {
    return { fill: "rgba(30, 58, 138, 0.35)", stroke: "#1e40af" };
  }
  if (delta < MS_DAY) {
    return { fill: "rgba(239, 68, 68, 0.9)", stroke: "#f87171", pulse: true };
  }
  if (delta < 7 * MS_DAY) {
    return { fill: "rgba(249, 115, 22, 0.85)", stroke: "#fb923c" };
  }
  if (delta < 30 * MS_DAY) {
    return { fill: "rgba(245, 158, 11, 0.8)", stroke: "#fbbf24" };
  }
  if (delta < 180 * MS_DAY) {
    return { fill: "rgba(59, 130, 246, 0.65)", stroke: "#60a5fa" };
  }
  return { fill: "rgba(30, 58, 138, 0.55)", stroke: "#1e40af" };
}
