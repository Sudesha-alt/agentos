import { z } from "zod";
import type { PrdOutput } from "../types/agents";
import type { ValidationIssue, ValidationResult } from "../types/pipeline";

const prdSchema = z.object({
  title: z.string().min(3),
  problemStatement: z.string().min(20),
  proposedSolution: z.string().min(20),
  userStories: z.array(z.string().min(8)).min(1),
  acceptanceCriteria: z.array(z.string().min(8)).min(2),
  outOfScope: z.array(z.string()),
  edgeCases: z.array(z.string()),
  dependencies: z.array(z.string()),
  successMetrics: z.array(z.string()),
  openQuestions: z.array(z.string()),
  confidenceScore: z.number().min(0).max(1),
  confidenceReason: z.string().min(8),
});

const VAGUE_PATTERNS = [
  /\bshould work\b/i,
  /\beasy to use\b/i,
  /\buser[- ]friendly\b/i,
  /\bfast\b(?! enough)/i,
  /\bnice\b/i,
  /\bproperly\b/i,
];

const BDD_PATTERN = /\bgiven\b.+\bwhen\b.+\bthen\b/i;

export type PrdValidationSource = "discovery" | "pm_agents";

export interface ValidatePrdOptions {
  /** Virin PRDs already passed product review — skip discovery-only confidence gate. */
  source?: PrdValidationSource;
}

/**
 * The PRD gate refuses output that is structurally invalid, contains
 * untestable language, or that lacks an explicit failure surface.
 */
export function validatePrd(prd: unknown, options?: ValidatePrdOptions): ValidationResult {
  const issues: ValidationIssue[] = [];
  const amberFlags: string[] = [];

  const schemaResult = prdSchema.safeParse(prd);
  if (!schemaResult.success) {
    for (const err of schemaResult.error.issues) {
      issues.push({
        code: "SCHEMA",
        severity: "error",
        message: err.message,
        path: err.path.join("."),
      });
    }
    return {
      passed: false,
      score: 0,
      issues,
      amberFlags,
      checkedAt: new Date().toISOString(),
    };
  }

  const data: PrdOutput = schemaResult.data;

  for (const criterion of data.acceptanceCriteria) {
    if (VAGUE_PATTERNS.some((p) => p.test(criterion))) {
      issues.push({
        code: "VAGUE_CRITERION",
        severity: "error",
        message: `Untestable language in acceptance criterion: "${criterion.slice(0, 80)}..."`,
      });
    }
    if (!BDD_PATTERN.test(criterion)) {
      amberFlags.push(
        `Acceptance criterion is not in given/when/then form: "${criterion.slice(0, 60)}..."`
      );
    }
  }

  if (data.edgeCases.length === 0) {
    amberFlags.push("No edge cases captured — engineering will have to guess.");
  }
  if (data.outOfScope.length === 0) {
    amberFlags.push("No out-of-scope items declared — scope creep risk is high.");
  }
  if (data.openQuestions.length > 0 && data.confidenceScore >= 0.8) {
    amberFlags.push(
      "Open questions present but confidence is high. Verify reviewer expectation."
    );
  }
  if (data.confidenceScore < 0.7 && options?.source !== "pm_agents") {
    issues.push({
      code: "LOW_CONFIDENCE",
      severity: "error",
      message: `PRD quality score ${data.confidenceScore} below 0.7 threshold — human clarification required.`,
    });
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const passed = errorCount === 0;
  const score = Math.max(
    0,
    1 - errorCount * 0.25 - amberFlags.length * 0.05
  );

  return {
    passed,
    score: Number(score.toFixed(2)),
    issues,
    amberFlags,
    checkedAt: new Date().toISOString(),
  };
}
