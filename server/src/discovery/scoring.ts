import type { GeneratedPRD } from "../prd/prdGenerator";
import type { RetrievedContext } from "../types/pipeline";
import type { ComplexityAssessment } from "./complexityScorer";
import type { GapAnalysis } from "./gapAnalyser";
import type { HistoricalIntelligence } from "./historicalIntelligence";
import type { TicketAnalysis } from "./ticketAnalyser";

export interface RetrievalStats {
  chunksFound: number;
  topSimilarity: number;
}

export type ProductRecommendation = "proceed" | "review" | "clarify";

export interface ScoreBand {
  point: number;
  uncertainty: number;
  low: number;
  high: number;
}

export interface ComputedDiscoveryScores {
  understandingScore: number;
  prdQualityScore: number;
  historicalSignalScore: number;
  complexityScore: number;
  passesGate: boolean;
  gateFailureReasons: string[];
  recommendation: ProductRecommendation;
  bands: {
    understanding: ScoreBand;
    prdQuality: ScoreBand;
    historicalSignal: ScoreBand;
  };
  breakdown: Record<string, number | string>;
}

export interface ProductValidationResult extends ComputedDiscoveryScores {}

const AMBIGUITY_PENALTY: Record<string, number> = {
  blocking: 0.15,
  high: 0.1,
  medium: 0.05,
  low: 0.02,
};

const READINESS_BASE: Record<string, number> = {
  ready: 0.88,
  "ready-with-assumptions": 0.72,
  "needs-clarification": 0.52,
};

const ROUGH_COMPLEXITY_BASE: Record<string, number> = {
  trivial: 2,
  small: 3.5,
  medium: 5.5,
  large: 7.5,
  epic: 9.5,
};

const CRITICAL_NFR_TYPES = ["performance", "security", "logging", "monitoring"] as const;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, Number(n.toFixed(3))));
}

function clamp110(n: number): number {
  return Math.max(1, Math.min(10, Math.round(n * 10) / 10));
}

function makeBand(point: number, uncertainty: number): ScoreBand {
  const u = uncertainty;
  return {
    point,
    uncertainty: u,
    low: clamp01(point - u),
    high: clamp01(point + u),
  };
}

function scoreUncertainty(
  understandingScore: number,
  chunksFound: number
): number {
  let u = 0.03;
  if (understandingScore < 0.5) u += 0.05;
  else if (understandingScore < 0.7) u += 0.03;
  if (chunksFound === 0) u += 0.04;
  return Math.min(0.12, u);
}

export function calculateUnderstandingScore(analysis: TicketAnalysis): number {
  let score = 1;

  for (const ambiguity of analysis.ambiguities ?? []) {
    score -= AMBIGUITY_PENALTY[ambiguity.impact] ?? 0.02;
  }

  for (const req of analysis.atomicRequirements ?? []) {
    if (req.clarity === "missing") score -= 0.1;
    else if (req.clarity === "ambiguous") score -= 0.06;
  }

  if (!analysis.atomicRequirements?.length) score -= 0.25;
  else if (analysis.atomicRequirements.length < 2) score -= 0.1;

  if (!analysis.coreIntent?.trim() || analysis.coreIntent.length < 20) {
    score -= 0.2;
  }

  if (!analysis.userPersonas?.length) score -= 0.1;

  const blockingCount = (analysis.ambiguities ?? []).filter(
    (a) => a.impact === "blocking"
  ).length;
  if (blockingCount > 2) score -= 0.1 * (blockingCount - 2);

  return clamp01(score);
}

export function calculateHistoricalSignal(
  retrievedContext: RetrievedContext[],
  intelligence: HistoricalIntelligence
): number {
  if (retrievedContext.length === 0) return 0;

  const coverageBonus: Record<string, number> = {
    rich: 0.4,
    moderate: 0.25,
    sparse: 0.12,
    none: 0,
  };

  const coverage = intelligence.historicalCoverage ?? "none";
  const avgSimilarity =
    retrievedContext.reduce((sum, ctx) => sum + ctx.similarity, 0) /
    retrievedContext.length;
  const similarityBonus = Math.min(avgSimilarity * 0.35, 0.35);
  const chunkBonus = Math.min((retrievedContext.length - 1) * 0.04, 0.12);

  const directPatterns = (intelligence.successPatterns ?? []).filter(
    (p) => p.applicability === "direct"
  ).length;
  const patternBonus = Math.min(directPatterns * 0.04, 0.12);

  const intelligencePenalty =
    intelligence.intelligenceConfidence < 0.5 ? 0.1 : 0;

  const raw =
    (coverageBonus[coverage] ?? 0) +
    similarityBonus +
    chunkBonus +
    patternBonus -
    intelligencePenalty;

  return clamp01(raw);
}

export function calculatePRDQuality(
  gapAnalysis: GapAnalysis,
  prd: GeneratedPRD,
  understandingScore: number
): number {
  let score = READINESS_BASE[gapAnalysis.readinessForPRD] ?? 0.52;

  score -= Math.min(gapAnalysis.blockingGaps * 0.06, 0.35);
  score -= Math.min(gapAnalysis.totalGaps * 0.015, 0.2);

  const missingCriticalNfrs = CRITICAL_NFR_TYPES.filter((type) =>
    gapAnalysis.nfrGaps.some((g) => g.type === type)
  ).length;
  score -= missingCriticalNfrs * 0.03;

  const stories = prd.userStories ?? [];
  const storiesWithFewCriteria = stories.filter(
    (s) => (s.acceptanceCriteria?.length ?? 0) < 2
  ).length;
  score -= storiesWithFewCriteria * 0.04;

  const mustHaveStories = stories.filter((s) => s.priority === "must-have").length;
  if (mustHaveStories === 0 && stories.length > 0) score -= 0.1;
  if (stories.length === 0) score -= 0.2;

  const blockingQuestions = (prd.openQuestions ?? []).filter(
    (q) => q.owner === "PM"
  ).length;
  score -= blockingQuestions * 0.03;

  if ((prd.problemStatement?.length ?? 0) < 80) score -= 0.06;
  if ((prd.proposedSolution?.length ?? 0) < 80) score -= 0.06;

  if (
    gapAnalysis.endpointGaps.length > 0 &&
    (prd.technicalRequirements?.endpoints?.length ?? 0) === 0
  ) {
    score -= 0.08;
  }

  const blended = score * 0.7 + understandingScore * 0.3;
  return clamp01(blended);
}

export function calculateComplexityScore(
  ticketAnalysis: TicketAnalysis,
  gapAnalysis: GapAnalysis,
  intelligence: HistoricalIntelligence,
  llmDimensions: ComplexityAssessment["dimensions"]
): number {
  let score = ROUGH_COMPLEXITY_BASE[ticketAnalysis.roughComplexity] ?? 5;

  score += Math.min(gapAnalysis.endpointGaps.length * 0.4, 2);
  score += Math.min(gapAnalysis.dataGaps.length * 0.5, 1.5);
  score += Math.min(gapAnalysis.blockingGaps * 0.3, 1);
  score += Math.min(gapAnalysis.nfrGaps.length * 0.2, 0.8);

  const reuseCredit = Math.min(intelligence.reuseOpportunities.length * 0.3, 1.2);
  score -= reuseCredit;

  const knownFailures = intelligence.knownFailures?.length ?? 0;
  score += Math.min(knownFailures * 0.25, 0.75);

  const dimensions = Object.values(llmDimensions);
  const avgDimension =
    dimensions.reduce((s, v) => s + v, 0) / dimensions.length;

  const blended = score * 0.55 + avgDimension * 0.45;
  return clamp110(blended);
}

export function buildFailureReasons(
  gapAnalysis: GapAnalysis,
  prd: GeneratedPRD,
  understandingScore: number,
  prdQualityScore: number
): string[] {
  const reasons: string[] = [];

  if (gapAnalysis.blockingGaps > 0) {
    reasons.push(
      `${gapAnalysis.blockingGaps} blocking gap(s) must be resolved`
    );
  }
  if (gapAnalysis.readinessForPRD === "needs-clarification") {
    reasons.push("PRD readiness is needs-clarification");
  }
  if (!prd.userStories?.length) {
    reasons.push("No user stories defined");
  } else if (prd.userStories.every((s) => (s.acceptanceCriteria?.length ?? 0) < 2)) {
    reasons.push("User stories lack sufficient acceptance criteria");
  }
  if (understandingScore < 0.5) {
    reasons.push(
      `Ticket understanding too low (${(understandingScore * 100).toFixed(0)}%)`
    );
  }
  if ((prd.problemStatement?.length ?? 0) < 80) {
    reasons.push("Problem statement too thin");
  }
  if (prdQualityScore < 0.7) {
    reasons.push(
      `PRD quality ${(prdQualityScore * 100).toFixed(0)}% below 70% gate threshold`
    );
  }

  return reasons;
}

export function runProductValidation(input: {
  ticketAnalysis: TicketAnalysis;
  historicalIntelligence: HistoricalIntelligence;
  gapAnalysis: GapAnalysis;
  prd: GeneratedPRD;
  retrievedContext: RetrievedContext[];
  complexityAssessment: ComplexityAssessment;
}): ProductValidationResult {
  const understandingScore = calculateUnderstandingScore(input.ticketAnalysis);
  const historicalSignalScore = calculateHistoricalSignal(
    input.retrievedContext,
    input.historicalIntelligence
  );
  const prdQualityScore = calculatePRDQuality(
    input.gapAnalysis,
    input.prd,
    understandingScore
  );
  const complexityScore = calculateComplexityScore(
    input.ticketAnalysis,
    input.gapAnalysis,
    input.historicalIntelligence,
    input.complexityAssessment.dimensions
  );

  const passesGate = prdQualityScore >= 0.7;
  const gateFailureReasons = passesGate
    ? []
    : buildFailureReasons(
        input.gapAnalysis,
        input.prd,
        understandingScore,
        prdQualityScore
      );

  const recommendation: ProductRecommendation =
    prdQualityScore >= 0.8
      ? "proceed"
      : prdQualityScore >= 0.65
        ? "review"
        : "clarify";

  const uncertainty = scoreUncertainty(
    understandingScore,
    input.retrievedContext.length
  );

  return {
    understandingScore,
    historicalSignalScore,
    prdQualityScore,
    complexityScore,
    passesGate,
    gateFailureReasons,
    recommendation,
    bands: {
      understanding: makeBand(understandingScore, uncertainty),
      prdQuality: makeBand(prdQualityScore, uncertainty),
      historicalSignal: makeBand(
        historicalSignalScore,
        input.retrievedContext.length === 0 ? 0.08 : uncertainty * 0.8
      ),
    },
    breakdown: {
      readiness: input.gapAnalysis.readinessForPRD,
      blockingGaps: input.gapAnalysis.blockingGaps,
      totalGaps: input.gapAnalysis.totalGaps,
      nfrGaps: input.gapAnalysis.nfrGaps.length,
      ambiguities: input.ticketAnalysis.ambiguities?.length ?? 0,
      blockingAmbiguities: (input.ticketAnalysis.ambiguities ?? []).filter(
        (a) => a.impact === "blocking"
      ).length,
      requirements: input.ticketAnalysis.atomicRequirements?.length ?? 0,
      ragChunks: input.retrievedContext.length,
      reuseOpportunities: input.historicalIntelligence.reuseOpportunities.length,
      recommendation,
    },
  };
}

/** @deprecated Use runProductValidation */
export function computeDiscoveryScores(input: {
  ticketAnalysis: TicketAnalysis;
  historicalIntelligence: HistoricalIntelligence;
  gapAnalysis: GapAnalysis;
  complexityAssessment: ComplexityAssessment;
  prd: GeneratedPRD;
  retrieval: RetrievalStats;
  retrievedContext?: RetrievedContext[];
}): ComputedDiscoveryScores {
  const chunks =
    input.retrievedContext ??
    Array.from({ length: input.retrieval.chunksFound }, (_, i) => ({
      jiraTicketId: "",
      jiraKey: "",
      contentType: "ticket" as const,
      content: "",
      similarity: input.retrieval.topSimilarity,
      metadata: {},
    }));

  return runProductValidation({
    ticketAnalysis: input.ticketAnalysis,
    historicalIntelligence: input.historicalIntelligence,
    gapAnalysis: input.gapAnalysis,
    prd: input.prd,
    retrievedContext: chunks,
    complexityAssessment: input.complexityAssessment,
  });
}

export function applyComputedScores(
  scores: ComputedDiscoveryScores,
  artifacts: {
    ticketAnalysis: TicketAnalysis;
    historicalIntelligence: HistoricalIntelligence;
    gapAnalysis: GapAnalysis;
    complexityAssessment: ComplexityAssessment;
    prd: GeneratedPRD;
  }
): void {
  artifacts.ticketAnalysis.understandingConfidence = scores.understandingScore;
  artifacts.historicalIntelligence.intelligenceConfidence =
    scores.historicalSignalScore;
  artifacts.complexityAssessment.overallScore = scores.complexityScore;
  artifacts.prd.prdConfidence = scores.prdQualityScore;
}

// Aliases for tests / imports
export const computeUnderstandingScore = calculateUnderstandingScore;
export const computePrdQualityScore = calculatePRDQuality;
export const computeHistoricalSignalScore = (
  intelligence: HistoricalIntelligence,
  retrieval: RetrievalStats,
  retrievedContext?: RetrievedContext[]
) =>
  calculateHistoricalSignal(
    retrievedContext ??
      Array.from({ length: retrieval.chunksFound }, () => ({
        jiraTicketId: "",
        jiraKey: "",
        contentType: "ticket" as const,
        content: "",
        similarity: retrieval.topSimilarity,
        metadata: {},
      })),
    intelligence
  );
