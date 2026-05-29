import type { QaExecutionReport } from "./reportGenerator";
import type { QaOutput } from "../../types/agents";

export function formatQaReportForJira(
  qaOutput: QaOutput,
  executionReport?: QaExecutionReport
): string {
  const lines: string[] = [
    "h2. AgentOS QA Report",
    "",
    `*Recommendation:* ${executionReport?.overallRecommendation ?? "pending"}`,
    "",
    "h3. Summary",
    qaOutput.testSummary,
    "",
    "h3. Coverage",
    `*Criteria covered:* ${qaOutput.coverageReport.coveredCriteria}/${qaOutput.coverageReport.totalCriteria} (${qaOutput.coverageReport.coveragePercent}%)`,
  ];

  if (qaOutput.coverageReport.uncoveredCriteria.length > 0) {
    lines.push("", "*Uncovered criteria:*");
    for (const criterion of qaOutput.coverageReport.uncoveredCriteria) {
      lines.push(`- ${criterion}`);
    }
  }

  if (executionReport?.testRun) {
    const run = executionReport.testRun;
    lines.push(
      "",
      "h3. Test execution",
      `*Run ID:* ${run.runId}`,
      `*Passed:* ${run.passed} | *Failed:* ${run.failed} | *Skipped:* ${run.skipped}`,
      `*Duration:* ${run.duration}ms`
    );
    if (run.message) {
      lines.push(`*Note:* ${run.message}`);
    }
  }

  if (executionReport?.failureAnalysis?.length) {
    lines.push("", "h3. Failure analysis");
    for (const item of executionReport.failureAnalysis) {
      lines.push(
        `*${item.testName}* [${item.severity}] — ${item.likelyCause}: ${item.remediation}`
      );
    }
  }

  lines.push("", "h3. Test cases");
  for (const testCase of qaOutput.testCases.slice(0, 25)) {
    lines.push(
      `*${testCase.id}* (${testCase.type}, ${testCase.priority}): ${testCase.title}`,
      `Criterion: ${testCase.linkedCriterion}`,
      `Expected: ${testCase.expectedResult}`,
      ""
    );
  }

  if (qaOutput.testCases.length > 25) {
    lines.push(`_…and ${qaOutput.testCases.length - 25} more test cases._`);
  }

  if (qaOutput.riskAreas.length > 0) {
    lines.push("", "h3. Risk areas");
    for (const risk of qaOutput.riskAreas) {
      lines.push(`- ${risk}`);
    }
  }

  return lines.join("\n");
}
