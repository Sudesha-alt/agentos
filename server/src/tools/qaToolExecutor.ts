import { formatToolResult } from "../agenticLoop/toolResultFormatter";
import { auditRepo } from "../db/repositories/auditRepo";
import { codebaseQueryService } from "../codebaseIntelligence/queryService";
import { githubClient } from "../integrations/githubClient";
import {
  generateQaReport,
  type FailureAnalysisItem,
  type QaRecommendation,
} from "../qa/report/reportGenerator";
import { getQaArtifacts } from "../qa/qaArtifactStore";
import { testRunner, type TestRunResult } from "../qa/testing/testRunner";
import { logger } from "../utils/logger";
import type { ToolCallInput, ToolCallResult } from "./executor";

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function arrayOfStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function defaultBranch(branchName?: string): string {
  return branchName || process.env.QA_DEFAULT_BRANCH || "main";
}

export async function executeQaToolCall(
  toolCall: ToolCallInput,
  pipelineId: string,
  jiraKey: string
): Promise<ToolCallResult> {
  const startTime = Date.now();

  logger.info(
    { tool: toolCall.name, pipelineId, jiraKey },
    "QA tool call executing"
  );

  await auditRepo.log(pipelineId, "QA_TOOL_CALL_STARTED", {
    tool: toolCall.name,
    input: toolCall.input,
  });

  try {
    let result: unknown;
    let metaQuery = toolCall.name;
    let resultsFound = 0;

    switch (toolCall.name) {
      case "read_implementation_files": {
        const paths = arrayOfStrings(toolCall.input.file_paths).slice(0, 10);
        const branch = defaultBranch(stringValue(toolCall.input.branch_name));
        const files = await Promise.all(
          paths.map(async (filePath) => {
            try {
              const file = await githubClient.getFileContent(filePath, branch);
              return { path: file.path, size: file.size, content: file.content };
            } catch (error) {
              return {
                path: filePath,
                error: error instanceof Error ? error.message : String(error),
              };
            }
          })
        );
        result = { branch, files };
        resultsFound = files.length;
        metaQuery = paths.join(", ");
        break;
      }

      case "search_implementation": {
        const query = stringValue(toolCall.input.query);
        const branch = defaultBranch(stringValue(toolCall.input.branch_name));
        const hits = await codebaseQueryService.searchCodebaseSemantically({
          query,
          branchName: branch,
          topK: 8,
        });
        const filters = arrayOfStrings(toolCall.input.filter_patterns);
        result = {
          query,
          branch,
          results: filters.length
            ? (hits as Array<{ file_path?: string }>).filter((hit) =>
                filters.some((pattern) =>
                  String(hit.file_path ?? "").includes(pattern)
                )
              )
            : hits,
        };
        resultsFound = Array.isArray((result as { results: unknown[] }).results)
          ? (result as { results: unknown[] }).results.length
          : 0;
        metaQuery = query;
        break;
      }

      case "read_existing_tests": {
        const branch = defaultBranch(stringValue(toolCall.input.branch_name));
        const testType = stringValue(toolCall.input.test_type, "any");
        let tree: Array<{ path: string; type: string }> = [];
        try {
          const items = await githubClient.getRepoTree(branch);
          tree = items
            .filter((item) => item.type === "blob")
            .filter((item) => isTestFile(item.path, testType))
            .slice(0, 12)
            .map((item) => ({ path: item.path, type: item.type }));
        } catch {
          tree = [];
        }

        const samples = await Promise.all(
          tree.slice(0, 5).map(async (item) => {
            try {
              const file = await githubClient.getFileContent(item.path, branch);
              return {
                path: file.path,
                preview: file.content.slice(0, 2500),
              };
            } catch {
              return { path: item.path, preview: "" };
            }
          })
        );

        result = { branch, testType, testFiles: tree, samples };
        resultsFound = tree.length;
        break;
      }

      case "analyse_code_paths": {
        const filePath = stringValue(toolCall.input.file_path);
        const branch = defaultBranch(stringValue(toolCall.input.branch_name));
        const functionName = stringValue(toolCall.input.function_name, "all");
        let content = "";
        try {
          const file = await githubClient.getFileContent(filePath, branch);
          content = file.content;
        } catch (error) {
          result = {
            error: error instanceof Error ? error.message : String(error),
          };
          break;
        }
        result = analyseCodePaths(content, functionName);
        resultsFound = countPaths(result);
        metaQuery = `${filePath}#${functionName}`;
        break;
      }

      case "generate_test_suite": {
        const targetFile = stringValue(toolCall.input.target_file);
        const testFilePath = stringValue(toolCall.input.test_file_path);
        const testCases = Array.isArray(toolCall.input.test_cases)
          ? toolCall.input.test_cases
          : [];
        result = {
          targetFile,
          testFilePath,
          testCaseCount: testCases.length,
          guidance:
            "Use write_test_file with complete Vitest/Jest tests following existing patterns.",
          suggestedStructure: buildSuggestedTestStructure(
            targetFile,
            testCases as Array<Record<string, unknown>>
          ),
        };
        resultsFound = testCases.length;
        break;
      }

      case "write_test_file": {
        const filePath = stringValue(toolCall.input.file_path);
        const content = stringValue(toolCall.input.content);
        const branch = defaultBranch(stringValue(toolCall.input.branch_name));
        const commitMessage = stringValue(toolCall.input.commit_message);
        const artifacts = getQaArtifacts(pipelineId);
        artifacts.stagedTestFiles.push({
          filePath,
          content,
          branchName: branch,
          commitMessage,
        });
        result = {
          written: true,
          filePath,
          branch,
          commitMessage,
          note: "Test file staged for sandbox execution (not pushed to GitHub).",
        };
        resultsFound = 1;
        break;
      }

      case "run_tests": {
        const branch = defaultBranch(stringValue(toolCall.input.branch_name));
        const runType = stringValue(toolCall.input.run_type, "full_suite") as
          | "new_tests_only"
          | "regression_only"
          | "full_suite";
        const testFiles = arrayOfStrings(toolCall.input.test_files);
        const timeoutSeconds =
          typeof toolCall.input.timeout_seconds === "number"
            ? toolCall.input.timeout_seconds
            : 120;
        const artifacts = getQaArtifacts(pipelineId);
        const run = await testRunner.runTestsInSandbox({
          branchName: branch,
          testFiles,
          runType,
          timeoutSeconds,
          stagedTestFiles: artifacts.stagedTestFiles.map((file) => ({
            filePath: file.filePath,
            content: file.content,
          })),
        });
        artifacts.lastTestRun = run;
        result = run;
        resultsFound = run.totalTests;
        break;
      }

      case "analyse_test_failures": {
        const failures = Array.isArray(toolCall.input.failures)
          ? (toolCall.input.failures as Array<Record<string, unknown>>)
          : [];
        const criteria = arrayOfStrings(toolCall.input.acceptance_criteria);
        const items = failures.map((failure, index) =>
          analyseFailure(failure, criteria, index)
        );
        result = { items, analysedCount: items.length };
        resultsFound = items.length;
        break;
      }

      case "generate_qa_report": {
        const recommendation = stringValue(
          toolCall.input.overall_recommendation,
          "request_changes"
        ) as QaRecommendation;
        const summary = stringValue(toolCall.input.summary);
        const artifacts = getQaArtifacts(pipelineId);
        const criteria = arrayOfStrings(
          (toolCall.input as { acceptance_criteria?: unknown })
            .acceptance_criteria
        );
        const report = generateQaReport({
          testResults:
            (toolCall.input.test_results as Record<string, unknown>) ??
            artifacts.lastTestRun ??
            {},
          failureAnalysis: toolCall.input.failure_analysis as
            | { items?: FailureAnalysisItem[] }
            | undefined,
          coverageData: toolCall.input.coverage_data as
            | TestRunResult["coverage"]
            | undefined,
          overallRecommendation: recommendation,
          summary,
          acceptanceCriteria: criteria,
        });
        artifacts.executionReport = report;
        result = report;
        resultsFound = 1;
        break;
      }

      default:
        throw new Error(`Unknown QA tool: ${toolCall.name}`);
    }

    const durationMs = Date.now() - startTime;
    await auditRepo.log(pipelineId, "QA_TOOL_CALL_COMPLETED", {
      tool: toolCall.name,
      durationMs,
      resultsFound,
    });

    return {
      toolUseId: toolCall.toolUseId,
      content: formatToolResult(toolCall.name, result),
      isError: false,
      meta: { query: metaQuery, resultsFound },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(
      { tool: toolCall.name, pipelineId, message },
      "QA tool call failed"
    );

    await auditRepo.log(pipelineId, "QA_TOOL_CALL_FAILED", {
      tool: toolCall.name,
      error: message,
    });

    return {
      toolUseId: toolCall.toolUseId,
      content: formatToolResult(toolCall.name, { error: message }),
      isError: true,
      meta: { query: toolCall.name, resultsFound: 0 },
    };
  }
}

function isTestFile(path: string, testType: string): boolean {
  const lower = path.toLowerCase();
  const isTest =
    lower.includes(".test.") ||
    lower.includes(".spec.") ||
    lower.includes("__tests__");
  if (!isTest) return false;
  if (testType === "any") return true;
  if (testType === "e2e") return lower.includes("e2e");
  if (testType === "integration") {
    return lower.includes("integration") || lower.includes("api");
  }
  return !lower.includes("e2e") && !lower.includes("integration");
}

function analyseCodePaths(content: string, functionName: string) {
  const slice =
    functionName === "all"
      ? content
      : extractFunctionBlock(content, functionName) ?? content;

  const happyPaths: string[] = [];
  const edgeCases: string[] = [];
  const errorPaths: string[] = [];
  const securityPaths: string[] = [];
  const concurrencyPaths: string[] = [];

  if (/return\s+/.test(slice)) happyPaths.push("Successful return path");
  if (/throw\s+new/.test(slice)) errorPaths.push("Explicit thrown errors");
  if (/catch\s*\(/.test(slice)) errorPaths.push("Caught exception handling");
  if (/if\s*\([^)]*!/.test(slice) || /if\s*\([^)]*===\s*null/.test(slice)) {
    edgeCases.push("Null/empty guard branches");
  }
  if (/auth|permission|role|token/i.test(slice)) {
    securityPaths.push("Auth or permission checks present");
  }
  if (/Promise\.all|race|mutex|lock|transaction/i.test(slice)) {
    concurrencyPaths.push("Concurrent or transactional logic");
  }
  if (slice.length > 0 && happyPaths.length === 0) {
    happyPaths.push("Default execution path");
  }

  return {
    functionName,
    happyPaths,
    edgeCases,
    errorPaths,
    securityPaths,
    concurrencyPaths,
    branchesDetected: (slice.match(/\bif\s*\(/g) ?? []).length,
    throwsDetected: (slice.match(/\bthrow\b/g) ?? []).length,
  };
}

function extractFunctionBlock(content: string, functionName: string): string | null {
  const patterns = [
    new RegExp(`function\\s+${functionName}[\\s\\S]*?(?=\\nfunction\\s|$)`),
    new RegExp(`${functionName}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\n\\}`),
    new RegExp(`${functionName}\\s*=\\s*\\([^)]*\\)\\s*=>[\\s\\S]*?(?=\\n\\w|$)`),
  ];
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) return match[0];
  }
  return null;
}

function countPaths(result: unknown): number {
  if (!result || typeof result !== "object") return 0;
  const record = result as Record<string, string[]>;
  return (
    (record.happyPaths?.length ?? 0) +
    (record.edgeCases?.length ?? 0) +
    (record.errorPaths?.length ?? 0) +
    (record.securityPaths?.length ?? 0) +
    (record.concurrencyPaths?.length ?? 0)
  );
}

function buildSuggestedTestStructure(
  targetFile: string,
  testCases: Array<Record<string, unknown>>
): string {
  const lines = [
    `import { describe, it, expect } from "vitest";`,
    `// Target: ${targetFile}`,
    "",
    `describe("${targetFile}", () => {`,
  ];
  for (const testCase of testCases.slice(0, 20)) {
    const title = stringValue(testCase.title, "case");
    lines.push(`  it("${title}", () => {`);
    lines.push(`    // ${stringValue(testCase.scenario)}`);
    lines.push(`    expect(true).toBe(false); // replace with real assertion`);
    lines.push(`  });`);
    lines.push("");
  }
  lines.push("});");
  return lines.join("\n");
}

function analyseFailure(
  failure: Record<string, unknown>,
  criteria: string[],
  index: number
): FailureAnalysisItem {
  const message = stringValue(failure.error_message);
  const testName = stringValue(failure.test_name, `failure-${index + 1}`);
  const testId = stringValue(failure.test_id, `TC-FAIL-${index + 1}`);

  const likelyCause: FailureAnalysisItem["likelyCause"] =
    /expect|assert|toBe|toEqual/i.test(message)
      ? "test"
      : /ECONNREFUSED|timeout|ENOTFOUND/i.test(message)
        ? "environment"
        : message
          ? "implementation"
          : "unknown";

  const severity: FailureAnalysisItem["severity"] =
    /auth|security|permission|sql injection/i.test(message)
      ? "critical"
      : likelyCause === "implementation"
        ? "high"
        : "medium";

  const violatedCriterion =
    criteria.find((criterion) =>
      message.toLowerCase().includes(criterion.toLowerCase().slice(0, 24))
    ) ?? criteria[0];

  return {
    testId,
    testName,
    severity,
    likelyCause,
    violatedCriterion,
    remediation:
      likelyCause === "test"
        ? "Fix the test assertion or test data setup."
        : likelyCause === "environment"
          ? "Verify test services, env vars, and sandbox connectivity."
          : "Inspect implementation against the linked acceptance criterion.",
  };
}
