import {
  buildFailureReasons,
  calculatePRDQuality,
} from "../discovery/scoring";
import type { GapAnalysis } from "../discovery/gapAnalyser";
import type { GeneratedPRD } from "../prd/prdGenerator";
import { validateGeneratedPrd } from "../prd/prdQualityGate";

const BDD_PATTERN = /\bgiven\b.+\bwhen\b.+\bthen\b/i;
const VAGUE_PATTERNS = [
  /\bfast\b/i,
  /\beasy\b/i,
  /\bgood\b/i,
  /\bwork(s)? well\b/i,
  /\bproperly\b/i,
  /\bseamless\b/i,
  /\bintuitive\b/i,
];
const EDGE_CASE_PATTERNS = [
  /\bempty\b/i,
  /\binvalid\b/i,
  /\berror\b/i,
  /\btimeout\b/i,
  /\bretry\b/i,
  /\bunauthori[sz]ed\b/i,
  /\bpermission\b/i,
  /\bfallback\b/i,
  /\bloading\b/i,
];
const NFR_PATTERNS = [
  /\bperformance\b/i,
  /\blatency\b/i,
  /\bp95\b/i,
  /\bsecurity\b/i,
  /\baudit\b/i,
  /\blogging\b/i,
  /\bmonitoring\b/i,
  /\baccessibility\b/i,
  /\brate limit\b/i,
  /\breliability\b/i,
];

export interface CompletenessIssue {
  severity: "error" | "warning";
  description: string;
  location: string;
  checkType: string;
}

interface CompletenessInputStory {
  id: string;
  story: string;
  acceptanceCriteria: string[];
}

export interface CompletenessResult {
  totalIssues: number;
  passedChecks: string[];
  issues: CompletenessIssue[];
}

export interface PrdReadinessResult {
  score: number;
  passesGate: boolean;
  recommendation: "proceed" | "review" | "clarify";
  failureReasons: string[];
}

export const validationTool = {
  async analyseCompleteness(input: {
    userStories: Array<{
      id: string;
      story: string;
      acceptanceCriteria: string[];
    }>;
    checkTypes: string[];
  }): Promise<CompletenessResult> {
    const stories = input.userStories.map(normalizeStory);
    const issues: CompletenessIssue[] = [];
    const passedChecks = new Set(input.checkTypes);

    if (input.checkTypes.includes("completeness")) {
      for (const story of stories) {
        if (!story.story || story.story.length < 15) {
          issues.push({
            severity: "error",
            description: "User story is too short to be actionable.",
            location: `${story.id}.story`,
            checkType: "completeness",
          });
        }
        if (story.acceptanceCriteria.length < 2) {
          issues.push({
            severity: "error",
            description: "User story needs at least two acceptance criteria.",
            location: `${story.id}.acceptance_criteria`,
            checkType: "completeness",
          });
        }
      }
    }

    if (input.checkTypes.includes("testability")) {
      for (const story of stories) {
        for (const [index, criterion] of story.acceptanceCriteria.entries()) {
          if (!BDD_PATTERN.test(criterion)) {
            issues.push({
              severity: "warning",
              description:
                "Acceptance criterion is not in Given/When/Then format.",
              location: `${story.id}.acceptance_criteria[${index}]`,
              checkType: "testability",
            });
          }
          if (criterion.trim().length < 20) {
            issues.push({
              severity: "warning",
              description:
                "Acceptance criterion is too terse to be reliably testable.",
              location: `${story.id}.acceptance_criteria[${index}]`,
              checkType: "testability",
            });
          }
        }
      }
    }

    if (input.checkTypes.includes("vague_language")) {
      for (const story of stories) {
        for (const [index, criterion] of story.acceptanceCriteria.entries()) {
          if (VAGUE_PATTERNS.some((pattern) => pattern.test(criterion))) {
            issues.push({
              severity: "error",
              description:
                "Acceptance criterion contains vague language that should be made measurable.",
              location: `${story.id}.acceptance_criteria[${index}]`,
              checkType: "vague_language",
            });
          }
        }
      }
    }

    if (input.checkTypes.includes("edge_cases")) {
      const hasEdgeCoverage = stories.some((story) =>
        story.acceptanceCriteria.some((criterion) =>
          EDGE_CASE_PATTERNS.some((pattern) => pattern.test(criterion))
        )
      );
      if (!hasEdgeCoverage) {
        issues.push({
          severity: "warning",
          description:
            "No acceptance criteria mention edge cases such as invalid input, permissions, errors, or empty states.",
          location: "user_stories",
          checkType: "edge_cases",
        });
      }
    }

    if (input.checkTypes.includes("nfr_coverage")) {
      const corpus = stories
        .flatMap((story) => [story.story, ...story.acceptanceCriteria])
        .join("\n");
      const hasNfrCoverage = NFR_PATTERNS.some((pattern) => pattern.test(corpus));
      if (!hasNfrCoverage) {
        issues.push({
          severity: "warning",
          description:
            "No clear non-functional coverage found for performance, security, auditability, or reliability.",
          location: "user_stories",
          checkType: "nfr_coverage",
        });
      }
    }

    for (const issue of issues) {
      passedChecks.delete(issue.checkType);
    }

    return {
      totalIssues: issues.length,
      passedChecks: [...passedChecks],
      issues,
    };
  },

  async scorePRDReadiness(input: {
    prdDraft: Record<string, unknown>;
    gapAnalysis: Record<string, unknown>;
  }): Promise<PrdReadinessResult> {
    const prd = input.prdDraft as unknown as GeneratedPRD;
    const gapAnalysis = input.gapAnalysis as unknown as GapAnalysis;
    const inferredUnderstanding = inferUnderstandingScore(prd);
    const score = calculatePRDQuality(gapAnalysis, prd, inferredUnderstanding);
    const structural = validateGeneratedPrd(prd);
    const recommendation: PrdReadinessResult["recommendation"] =
      score >= 0.8 ? "proceed" : score >= 0.65 ? "review" : "clarify";

    const failureReasons = dedupeStrings([
      ...structural.issues,
      ...buildFailureReasons(gapAnalysis, prd, inferredUnderstanding, score),
    ]);

    return {
      score,
      passesGate: score >= 0.7 && structural.passed,
      recommendation,
      failureReasons,
    };
  },
};

function normalizeStory(story: {
  id: string;
  story: string;
  acceptanceCriteria?: string[];
}): CompletenessInputStory {
  return {
    id: story.id,
    story: story.story,
    acceptanceCriteria: Array.isArray(story.acceptanceCriteria)
      ? story.acceptanceCriteria.map((item) => String(item))
      : [],
  };
}

function inferUnderstandingScore(prd: Partial<GeneratedPRD>): number {
  const directConfidence =
    typeof prd.prdConfidence === "number" ? prd.prdConfidence : null;
  if (directConfidence !== null) {
    return clamp01(directConfidence);
  }

  let score = 0.75;
  if (!prd.problemStatement || prd.problemStatement.length < 80) score -= 0.1;
  if (!prd.proposedSolution || prd.proposedSolution.length < 80) score -= 0.1;
  if (!Array.isArray(prd.userStories) || prd.userStories.length === 0) score -= 0.15;
  if (!Array.isArray(prd.openQuestions) || prd.openQuestions.length > 2) score -= 0.05;
  return clamp01(score);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(3))));
}

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}
