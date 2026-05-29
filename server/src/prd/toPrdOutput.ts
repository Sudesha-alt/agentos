import type { ComputedDiscoveryScores } from "../discovery/scoring";
import type { PrdOutput } from "../types/agents";
import type { GeneratedPRD } from "./prdGenerator";

/** Maps discovery PRD into the shape expected by engineering/QA agents and validators. */
export function generatedPrdToPrdOutput(
  prd: GeneratedPRD,
  scores?: ComputedDiscoveryScores
): PrdOutput {
  const acceptanceCriteria = (prd.userStories ?? []).flatMap(
    (s) => s.acceptanceCriteria ?? []
  );
  const edgeCases = (prd.risks ?? []).map(
    (r) => `[${r.probability}] ${r.risk} — ${r.mitigation}`
  );
  const openQuestions = (prd.openQuestions ?? []).map(
    (q) => `${q.question} (default: ${q.defaultAssumption}, owner: ${q.owner})`
  );
  const dependencies = [
    ...(prd.technicalRequirements?.systemsAffected ?? []),
    ...(prd.assumptions ?? []),
  ].filter(Boolean);
  const successMetrics = (prd.successMetrics ?? []).map(
    (m) => `${m.metric}: ${m.target} (from ${m.baseline}) — ${m.measurementMethod}`
  );

  return {
    title: prd.title,
    problemStatement: prd.problemStatement,
    proposedSolution: prd.proposedSolution,
    userStories: (prd.userStories ?? []).map((s) => s.story),
    acceptanceCriteria:
      acceptanceCriteria.length > 0
        ? acceptanceCriteria
        : ["Given context When action Then measurable outcome"],
    outOfScope: prd.outOfScope ?? [],
    edgeCases,
    dependencies,
    successMetrics,
    openQuestions,
    confidenceScore: scores?.prdQualityScore ?? prd.prdConfidence ?? 0.75,
    confidenceReason: buildScoreReason(scores, prd),
  };
}

function buildScoreReason(
  scores: ComputedDiscoveryScores | undefined,
  prd: GeneratedPRD
): string {
  if (!scores) {
    return prd.confidenceNotes ?? "Generated via discovery pipeline";
  }
  const band = scores.bands.prdQuality;
  const b = scores.breakdown;
  const parts = [
    `PRD quality ${(band.point * 100).toFixed(0)}% ±${(band.uncertainty * 100).toFixed(0)}%`,
    `(${Math.round(band.low * 100)}–${Math.round(band.high * 100)}%).`,
    `Recommendation: ${scores.recommendation}.`,
    `Readiness ${b.readiness}, blocking gaps ${b.blockingGaps}.`,
  ];
  if (!scores.passesGate && scores.gateFailureReasons.length) {
    parts.push(`Gate: ${scores.gateFailureReasons.join("; ")}.`);
  }
  return parts.join(" ");
}
