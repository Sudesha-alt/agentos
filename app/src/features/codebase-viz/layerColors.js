const MS_DAY = 86_400_000;

export const LAYERS = {
  structure: "structure",
  activity: "activity",
  quality: "quality",
  understanding: "understanding",
};

export function activityColor(lastModified, agentOverlay, lastModifiedBy) {
  if (agentOverlay && lastModifiedBy === "agent") {
    return { fill: "rgba(168, 85, 247, 0.85)", stroke: "#c084fc", pulse: true };
  }
  if (!lastModified) {
    return { fill: "rgba(30, 58, 138, 0.75)", stroke: "#1e3a8a" };
  }
  const age = Date.now() - new Date(lastModified).getTime();
  if (age < MS_DAY) {
    return { fill: "rgba(239, 68, 68, 0.9)", stroke: "#f87171", pulse: true };
  }
  if (age < 7 * MS_DAY) {
    return { fill: "rgba(249, 115, 22, 0.85)", stroke: "#fb923c" };
  }
  if (age < 30 * MS_DAY) {
    return { fill: "rgba(245, 158, 11, 0.8)", stroke: "#fbbf24" };
  }
  if (age < 180 * MS_DAY) {
    return { fill: "rgba(59, 130, 246, 0.65)", stroke: "#60a5fa" };
  }
  return { fill: "rgba(30, 58, 138, 0.55)", stroke: "#1e40af" };
}

export function qualityStyle(coverage, complexity) {
  const fillRatio = Math.max(0, Math.min(1, coverage / 100));
  const r = Math.round(239 * (1 - fillRatio) + 34 * fillRatio);
  const g = Math.round(68 * (1 - fillRatio) + 197 * fillRatio);
  const b = Math.round(68 * (1 - fillRatio) + 94 * fillRatio);
  const border = Math.max(1, Math.round((complexity / 10) * 4));
  const risky = coverage < 60 && complexity >= 7;
  return {
    fill: `rgba(${r}, ${g}, ${b}, ${0.25 + fillRatio * 0.55})`,
    stroke: risky ? "#f59e0b" : `rgb(${r}, ${g}, ${b})`,
    border,
    pulse: risky,
  };
}

export function structureColor(depth) {
  const palette = [
    "rgba(99, 102, 241, 0.55)",
    "rgba(79, 70, 229, 0.5)",
    "rgba(67, 56, 202, 0.45)",
    "rgba(55, 48, 163, 0.4)",
  ];
  return {
    fill: palette[Math.min(depth, palette.length - 1)],
    stroke: "rgba(129, 140, 248, 0.6)",
  };
}

export function understandingColor(patterns) {
  const tag = patterns?.[0] ?? "utility";
  const map = {
    "api-route": "rgba(56, 189, 248, 0.7)",
    "service-layer": "rgba(167, 139, 250, 0.7)",
    "data-model": "rgba(52, 211, 153, 0.7)",
    middleware: "rgba(251, 191, 36, 0.7)",
    test: "rgba(148, 163, 184, 0.55)",
    "ui-component": "rgba(244, 114, 182, 0.65)",
    utility: "rgba(100, 116, 139, 0.55)",
  };
  return { fill: map[tag] ?? map.utility, stroke: "#94a3b8", tag };
}

export function patternLabel(patterns) {
  return patterns?.[0]?.replace(/-/g, " ") ?? "module";
}
