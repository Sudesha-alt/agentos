/** Agent pipeline effort calibration — Virin discovery → Ananta engineering → Neel QA */

export type AgentPipelineBand = "XS" | "S" | "M" | "L" | "XL";

export const AGENT_STAGE_DURATION = {
  discovery: { minMinutes: 15, maxMinutes: 45, label: "Virin (discovery)" },
  engineering: { minMinutes: 30, maxMinutes: 360, label: "Ananta (engineering)" },
  qa: { minMinutes: 15, maxMinutes: 60, label: "Neel (QA)" },
  review: { minMinutes: 10, maxMinutes: 30, label: "Review / handoff" },
} as const;

/** Total end-to-end agent pipeline wall-clock ranges by t-shirt band (hours). */
export const AGENT_PIPELINE_BAND_HOURS: Record<
  AgentPipelineBand,
  { min: number; max: number }
> = {
  XS: { min: 0.5, max: 1.5 },
  S: { min: 1, max: 3 },
  M: { min: 3, max: 8 },
  L: { min: 8, max: 16 },
  XL: { min: 16, max: 40 },
};

/** Realistic agent pipeline hours above this threshold should be broken into sub-tickets. */
export const AGENT_PIPELINE_BREAKDOWN_THRESHOLD_HOURS = 8;

/** storyPoints field maps to pipeline complexity band (Fibonacci-style relative sizing). */
export const PIPELINE_COMPLEXITY_BANDS: Record<string, AgentPipelineBand> = {
  "1": "XS",
  "2": "S",
  "3": "S",
  "5": "M",
  "8": "L",
  "13": "XL",
};

export const DEFAULT_AGENT_PIPELINE_BREAKDOWN = {
  discovery: "30m",
  engineering: "2h",
  qa: "45m",
  review: "15m",
} as const;

export const PROMPT_AGENT_PIPELINE_EFFORT_GUIDANCE = `
Estimate end-to-end AgentOS agent pipeline wall-clock time (NOT human developer sprint days).
Pipeline stages: Virin discovery (15–45 min) → Ananta engineering (30 min–6 h) → Neel QA (15–60 min) → brief review/handoff.
Typical total ranges: XS 30–90 min, S 1–3 h, M 3–8 h, L 8–16 h, XL 16–40 h (split if >8 h realistic).
Express effortEstimate values in hours (decimals OK, e.g. 0.75 for 45 min). Set shouldBreakDown true when realistic > 8 hours.
`.trim();

export const PROMPT_AGENT_PIPELINE_COMPLEXITY_SUMMARY = `
complexitySummary effort strings must use agent pipeline hours (e.g. "4h", "6.5h"), not human sprint days.
`.trim();

export function formatAgentEffortHours(hours: number): string {
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes}m`;
  }
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}h` : `${rounded}h`;
}

export function shouldBreakDownAgentPipeline(realisticHours: number): boolean {
  return realisticHours > AGENT_PIPELINE_BREAKDOWN_THRESHOLD_HOURS;
}

export function scoreToAgentPipelineBand(score: number): AgentPipelineBand {
  if (score <= 2) return "XS";
  if (score <= 4) return "S";
  if (score <= 6) return "M";
  if (score <= 8) return "L";
  return "XL";
}

export function roughComplexityToAgentBand(
  rough: "trivial" | "small" | "medium" | "large" | "epic"
): AgentPipelineBand {
  const map: Record<typeof rough, AgentPipelineBand> = {
    trivial: "XS",
    small: "S",
    medium: "M",
    large: "L",
    epic: "XL",
  };
  return map[rough];
}
