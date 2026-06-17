import type { TestRunResult } from "../testing/testRunner";
import type { SecurityScanResult } from "../testing/securityScanner";

export type QaRecommendation =
  | "approve"
  | "approve_with_conditions"
  | "request_changes"
  | "block";

export interface FailureAnalysisItem {
  testId: string;
  testName: string;
  severity: "critical" | "high" | "medium" | "low";
  likelyCause: "implementation" | "test" | "environment" | "unknown";
  violatedCriterion?: string;
  remediation: string;
}

export interface QaExecutionReport {
  generatedAt: string;
  summary: string;
  overallRecommendation: QaRecommendation;
  testRun?: TestRunResult;
  failureAnalysis?: FailureAnalysisItem[];
  coverage?: TestRunResult["coverage"];
  criteriaCoverage: {
    total: number;
    covered: number;
    uncovered: string[];
  };
  securityScan?: SecurityScanResult;
}

export function generateQaReport(input: {
  testResults: TestRunResult | Record<string, unknown>;
  failureAnalysis?: { items?: FailureAnalysisItem[] };
  coverageData?: TestRunResult["coverage"];
  overallRecommendation: QaRecommendation;
  summary: string;
  acceptanceCriteria: string[];
  securityScan?: SecurityScanResult;
}): QaExecutionReport {
  const testRun = normalizeTestRun(input.testResults);
  const failureItems = input.failureAnalysis?.items ?? [];

  const covered = input.acceptanceCriteria.filter((criterion) =>
    failureItems.every((item) => item.violatedCriterion !== criterion)
  );

  return {
    generatedAt: new Date().toISOString(),
    summary: input.summary,
    overallRecommendation: input.overallRecommendation,
    testRun,
    failureAnalysis: failureItems,
    coverage: input.coverageData ?? testRun?.coverage,
    criteriaCoverage: {
      total: input.acceptanceCriteria.length,
      covered: covered.length,
      uncovered: input.acceptanceCriteria.filter((c) => !covered.includes(c)),
    },
    securityScan: input.securityScan,
  };
}

function normalizeTestRun(
  value: TestRunResult | Record<string, unknown>
): TestRunResult | undefined {
  if (!value || typeof value !== "object") return undefined;
  if ("runId" in value && "testResults" in value) {
    return value as TestRunResult;
  }
  return undefined;
}
