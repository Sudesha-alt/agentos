/**
 * Normalizes PRODUCT_AGENT stage output (discovery pipeline or legacy PRD).
 */

export function parseDiscoveryOutput(output) {
  if (!output || typeof output !== "object") return null;

  const o = output;

  if (o.discovery && (o.prd || o.discovery.generatedPrd)) {
    return {
      mode: "full",
      prd: o.prd ?? null,
      scores: o.scores ?? null,
      ticketAnalysis: o.discovery.ticketAnalysis ?? null,
      historicalIntelligence: o.discovery.historicalIntelligence ?? null,
      gapAnalysis: o.discovery.gapAnalysis ?? null,
      complexityAssessment: o.discovery.complexityAssessment ?? null,
      generatedPrd: o.discovery.generatedPrd ?? null,
    };
  }

  if (o.ticketAnalysis || o.gapAnalysis || o.generatedPrd) {
    return {
      mode: "full",
      prd: o.prd ?? null,
      scores: o.scores ?? null,
      ticketAnalysis: o.ticketAnalysis ?? null,
      historicalIntelligence: o.historicalIntelligence ?? null,
      gapAnalysis: o.gapAnalysis ?? null,
      complexityAssessment: o.complexityAssessment ?? null,
      generatedPrd: o.generatedPrd ?? null,
    };
  }

  if (o.title && o.problemStatement) {
    return {
      mode: "legacy",
      prd: o,
      scores: o.scores ?? null,
      ticketAnalysis: null,
      historicalIntelligence: null,
      gapAnalysis: null,
      complexityAssessment: null,
      generatedPrd: null,
    };
  }

  return null;
}

export function hasDiscoveryContent(parsed) {
  return Boolean(parsed && (parsed.mode === "full" || parsed.prd));
}

/** Formula-based scores from server (`scores` object). Never read LLM self-ratings in UI. */
export function getDiscoveryScores(parsed) {
  if (!parsed) return null;
  if (parsed.scores) return parsed.scores;

  const understanding = parsed.ticketAnalysis?.understandingConfidence;
  const prdQuality =
    parsed.generatedPrd?.prdConfidence ?? parsed.prd?.confidenceScore;
  const historical = parsed.historicalIntelligence?.intelligenceConfidence;
  const complexity = parsed.complexityAssessment?.overallScore;

  if (
    understanding == null &&
    prdQuality == null &&
    historical == null &&
    complexity == null
  ) {
    return null;
  }

  const point = prdQuality ?? 0;
  const u = 0.08;
  return {
    understandingScore: understanding,
    prdQualityScore: prdQuality,
    historicalSignalScore: historical,
    complexityScore: complexity,
    passesGate: typeof prdQuality === "number" ? prdQuality >= 0.7 : false,
    gateFailureReasons: [],
    recommendation:
      prdQuality >= 0.8 ? "proceed" : prdQuality >= 0.65 ? "review" : "clarify",
    bands: {
      understanding: { point: understanding ?? 0, uncertainty: u, low: 0, high: 1 },
      prdQuality: { point, uncertainty: u, low: clamp01(point - u), high: clamp01(point + u) },
      historicalSignal: { point: historical ?? 0, uncertainty: u, low: 0, high: 1 },
    },
    breakdown: parsed.gapAnalysis
      ? {
          readiness: parsed.gapAnalysis.readinessForPRD,
          blockingGaps: parsed.gapAnalysis.blockingGaps,
          totalGaps: parsed.gapAnalysis.totalGaps,
        }
      : {},
  };
}

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

export function formatScorePercent(score) {
  if (typeof score !== "number") return "—";
  return `${Math.round(score * 100)}%`;
}
