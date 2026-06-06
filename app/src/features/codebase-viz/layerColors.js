const MS_DAY = 86_400_000;

export const LAYERS = {
  structure: "structure",
  language: "language",
  activity: "activity",
  quality: "quality",
  understanding: "understanding",
  agent: "agent",
};

const LANGUAGE_COLORS = {
  typescript: { fill: "rgba(49, 120, 198, 0.75)", stroke: "#3178c6" },
  ts: { fill: "rgba(49, 120, 198, 0.75)", stroke: "#3178c6" },
  tsx: { fill: "rgba(97, 175, 239, 0.75)", stroke: "#61afef" },
  javascript: { fill: "rgba(247, 223, 30, 0.7)", stroke: "#f7df1e" },
  js: { fill: "rgba(247, 223, 30, 0.7)", stroke: "#f7df1e" },
  jsx: { fill: "rgba(97, 218, 251, 0.7)", stroke: "#61dafb" },
  python: { fill: "rgba(55, 118, 171, 0.75)", stroke: "#3776ab" },
  py: { fill: "rgba(55, 118, 171, 0.75)", stroke: "#3776ab" },
  go: { fill: "rgba(0, 173, 216, 0.7)", stroke: "#00add8" },
  rust: { fill: "rgba(222, 165, 132, 0.75)", stroke: "#dea584" },
  rs: { fill: "rgba(222, 165, 132, 0.75)", stroke: "#dea584" },
  sql: { fill: "rgba(224, 102, 51, 0.7)", stroke: "#e06633" },
  json: { fill: "rgba(251, 191, 36, 0.55)", stroke: "#fbbf24" },
  yaml: { fill: "rgba(203, 166, 247, 0.6)", stroke: "#cba6f7" },
  yml: { fill: "rgba(203, 166, 247, 0.6)", stroke: "#cba6f7" },
  markdown: { fill: "rgba(148, 163, 184, 0.6)", stroke: "#94a3b8" },
  md: { fill: "rgba(148, 163, 184, 0.6)", stroke: "#94a3b8" },
  mdx: { fill: "rgba(148, 163, 184, 0.55)", stroke: "#cbd5e1" },
  prisma: { fill: "rgba(45, 212, 191, 0.65)", stroke: "#2dd4bf" },
  graphql: { fill: "rgba(225, 29, 72, 0.65)", stroke: "#e11d48" },
  java: { fill: "rgba(237, 139, 0, 0.7)", stroke: "#ed8b00" },
  css: { fill: "rgba(168, 85, 247, 0.6)", stroke: "#a855f7" },
  html: { fill: "rgba(239, 68, 68, 0.65)", stroke: "#ef4444" },
};

export function languageColor(language) {
  const key = (language ?? "text").toLowerCase();
  const style = LANGUAGE_COLORS[key] ?? {
    fill: "rgba(100, 116, 139, 0.5)",
    stroke: "#64748b",
  };
  return { ...style, tag: key };
}

/** Agent activity layer — purple for agent, human heat otherwise. */
export function agentColor(lastModified, lastModifiedBy) {
  if (lastModifiedBy === "agent") {
    return { fill: "rgba(168, 85, 247, 0.85)", stroke: "#c084fc", pulse: true, tag: "agent" };
  }
  if (lastModifiedBy === "human") {
    const heat = activityColor(lastModified, false, "human");
    return { ...heat, tag: "human" };
  }
  return { fill: "rgba(71, 85, 105, 0.45)", stroke: "#475569", tag: "unknown" };
}

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
