import { z } from "zod";
import type { PrdOutput, QaOutput } from "../types/agents";
import type { ValidationIssue, ValidationResult } from "../types/pipeline";

const qaSchema = z.object({
  testSummary: z.string().min(20),
  testCases: z
    .array(
      z.object({
        id: z.string().regex(/^TC-\d{3,}$/),
        title: z.string().min(4),
        type: z.enum([
          "unit",
          "integration",
          "e2e",
          "security",
          "performance",
        ]),
        linkedCriterion: z.string().min(4),
        preconditions: z.array(z.string()),
        steps: z.array(z.string().min(2)).min(1),
        expectedResult: z.string().min(4),
        priority: z.enum(["critical", "high", "medium", "low"]),
      })
    )
    .min(1),
  coverageReport: z.object({
    totalCriteria: z.number().int().nonnegative(),
    coveredCriteria: z.number().int().nonnegative(),
    coveragePercent: z.number().min(0).max(100),
    uncoveredCriteria: z.array(z.string()),
  }),
  riskAreas: z.array(z.string()),
  automationRecommendations: z.array(z.string()),
  confidenceScore: z.number().min(0).max(1),
  confidenceReason: z.string().min(8),
});

const MIN_COVERAGE_PERCENT = 95;

/**
 * The QA gate enforces that every acceptance criterion is actually covered
 * by at least one test case and that the reported coverage matches reality.
 */
export function validateQa(qa: unknown, prd: PrdOutput): ValidationResult {
  const issues: ValidationIssue[] = [];
  const amberFlags: string[] = [];

  const schemaResult = qaSchema.safeParse(qa);
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

  const data: QaOutput = schemaResult.data;

  const linkedCriteria = data.testCases.map((tc) => tc.linkedCriterion);
  const trulyCovered = prd.acceptanceCriteria.filter((c) =>
    linkedCriteria.some((linked) => criterionIsCovered(linked, c))
  );
  const trulyUncovered = prd.acceptanceCriteria.filter(
    (c) => !linkedCriteria.some((linked) => criterionIsCovered(linked, c))
  );

  if (data.coverageReport.totalCriteria !== prd.acceptanceCriteria.length) {
    issues.push({
      code: "COVERAGE_TOTAL_MISMATCH",
      severity: "error",
      message: `QA coverage totalCriteria=${data.coverageReport.totalCriteria}, expected ${prd.acceptanceCriteria.length}.`,
    });
  }
  if (data.coverageReport.coveredCriteria !== trulyCovered.length) {
    issues.push({
      code: "COVERAGE_COUNT_MISMATCH",
      severity: "error",
      message: `Reported covered=${data.coverageReport.coveredCriteria}, actual=${trulyCovered.length}.`,
    });
  }

  const actualPercent =
    prd.acceptanceCriteria.length === 0
      ? 100
      : (trulyCovered.length / prd.acceptanceCriteria.length) * 100;

  if (actualPercent < MIN_COVERAGE_PERCENT) {
    issues.push({
      code: "COVERAGE_BELOW_THRESHOLD",
      severity: "error",
      message: `Coverage ${actualPercent.toFixed(1)}% below ${MIN_COVERAGE_PERCENT}% threshold. Uncovered: ${trulyUncovered
        .map((c) => `"${c.slice(0, 60)}..."`)
        .join("; ")}`,
    });
  }

  const ids = new Set<string>();
  for (const tc of data.testCases) {
    if (ids.has(tc.id)) {
      issues.push({
        code: "DUPLICATE_TEST_ID",
        severity: "error",
        message: `Duplicate test case id ${tc.id}`,
      });
    }
    ids.add(tc.id);
  }

  const criticalCases = data.testCases.filter(
    (t) => t.priority === "critical"
  );
  if (criticalCases.length === 0) {
    amberFlags.push("No critical-priority test cases. Verify scope is correct.");
  }

  if (data.confidenceScore < 0.7) {
    issues.push({
      code: "LOW_CONFIDENCE",
      severity: "error",
      message: `QA confidence ${data.confidenceScore} below 0.7 threshold.`,
    });
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const passed = errorCount === 0;
  const score = Math.max(
    0,
    1 - errorCount * 0.2 - amberFlags.length * 0.04
  );

  return {
    passed,
    score: Number(score.toFixed(2)),
    issues,
    amberFlags,
    checkedAt: new Date().toISOString(),
  };
}

/** Normalize acceptance criterion text for PRD ↔ QA linkedCriterion comparison. */
export function normalizeCriterion(s: string): string {
  return s
    .trim()
    .replace(/^\d+\.\s*/, "")
    .replace(/^[-*•]\s*/, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function criterionIsCovered(linkedCriterion: string, prdCriterion: string): boolean {
  const linked = normalizeCriterion(linkedCriterion);
  const prd = normalizeCriterion(prdCriterion);
  if (!linked || !prd) return false;
  if (linked === prd) return true;
  // Allow minor truncation when the model shortens the criterion slightly.
  if (linked.length >= 24 && prd.startsWith(linked)) return true;
  if (prd.length >= 24 && linked.startsWith(prd)) return true;
  return false;
}
