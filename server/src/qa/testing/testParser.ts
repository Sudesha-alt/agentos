export interface ParsedTestResult {
  testId: string;
  testName: string;
  status: "pass" | "fail" | "skip" | "error";
  duration: number;
  errorMessage?: string;
  stackTrace?: string;
}

export interface ParsedTestRun {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  errors: number;
  testResults: ParsedTestResult[];
}

export interface ParsedCoverage {
  lines: number;
  statements: number;
  functions: number;
  branches: number;
  uncoveredFiles: string[];
}

export function parseTestOutput(output: string): ParsedTestRun {
  const testResults: ParsedTestResult[] = [];

  const vitestJson = tryParseVitestJson(output);
  if (vitestJson) {
    return vitestJson;
  }

  const jestJson = tryParseJestJson(output);
  if (jestJson) {
    return jestJson;
  }

  return emptyResults();
}

function tryParseVitestJson(output: string): ParsedTestRun | null {
  const testResults: ParsedTestResult[] = [];
  try {
    const match = output.match(/\{[\s\S]*"testResults"[\s\S]*\}/);
    if (!match) return null;

    const data = JSON.parse(match[0]) as {
      testResults?: Array<{
        name?: string;
        status?: string;
        duration?: number;
        assertionResults?: Array<{
          fullName?: string;
          status?: string;
          duration?: number;
          failureMessages?: string[];
        }>;
      }>;
    };

    for (const file of data.testResults ?? []) {
      for (const test of file.assertionResults ?? []) {
        testResults.push(mapTestResult(test.fullName ?? test.status ?? "unknown", test));
      }
      if (!file.assertionResults?.length && file.name) {
        testResults.push(
          mapTestResult(file.name, {
            status: file.status,
            duration: file.duration,
          })
        );
      }
    }

    return summarize(testResults);
  } catch {
    return null;
  }
}

function tryParseJestJson(output: string): ParsedTestRun | null {
  const testResults: ParsedTestResult[] = [];
  try {
    const match = output.match(/\{[\s\S]*"testResults"[\s\S]*\}/);
    if (!match) return null;

    const jestOutput = JSON.parse(match[0]) as {
      testResults?: Array<{
        testResults?: Array<{
          fullName?: string;
          status?: string;
          duration?: number;
          failureMessages?: string[];
        }>;
      }>;
    };

    for (const suite of jestOutput.testResults ?? []) {
      for (const test of suite.testResults ?? []) {
        testResults.push(mapTestResult(test.fullName ?? "unknown", test));
      }
    }

    return summarize(testResults);
  } catch {
    return null;
  }
}

function mapTestResult(
  name: string,
  test: {
    status?: string;
    duration?: number;
    failureMessages?: string[];
  }
): ParsedTestResult {
  const statusRaw = (test.status ?? "").toLowerCase();
  const status: ParsedTestResult["status"] =
    statusRaw === "passed" || statusRaw === "pass"
      ? "pass"
      : statusRaw === "failed" || statusRaw === "fail"
        ? "fail"
        : statusRaw === "pending" || statusRaw === "skipped" || statusRaw === "skip"
          ? "skip"
          : "error";

  return {
    testId: generateTestId(name),
    testName: name,
    status,
    duration: test.duration ?? 0,
    errorMessage: test.failureMessages?.[0]?.split("\n")[0],
    stackTrace: test.failureMessages?.[0],
  };
}

function summarize(testResults: ParsedTestResult[]): ParsedTestRun {
  return {
    total: testResults.length,
    passed: testResults.filter((t) => t.status === "pass").length,
    failed: testResults.filter((t) => t.status === "fail").length,
    skipped: testResults.filter((t) => t.status === "skip").length,
    errors: testResults.filter((t) => t.status === "error").length,
    testResults,
  };
}

export function parseCoverageOutput(output: string): ParsedCoverage | undefined {
  try {
    const coverageMatch = output.match(
      /All files[^\n]*\n[^\n]*\|\s*(\d+(?:\.\d+)?)\s*\|\s*(\d+(?:\.\d+)?)\s*\|\s*(\d+(?:\.\d+)?)\s*\|\s*(\d+(?:\.\d+)?)/
    );

    if (!coverageMatch) return undefined;

    return {
      statements: parseFloat(coverageMatch[1]),
      branches: parseFloat(coverageMatch[2]),
      functions: parseFloat(coverageMatch[3]),
      lines: parseFloat(coverageMatch[4]),
      uncoveredFiles: extractUncoveredFiles(output),
    };
  } catch {
    return undefined;
  }
}

function extractUncoveredFiles(output: string): string[] {
  const uncovered: string[] = [];
  for (const line of output.split("\n")) {
    if (!line.includes("|")) continue;
    const parts = line.split("|");
    const coverage = parseFloat(parts[1]?.trim() ?? "");
    if (!isNaN(coverage) && coverage < 80) {
      const fileName = parts[0]?.trim();
      if (fileName) uncovered.push(fileName);
    }
  }
  return uncovered;
}

function generateTestId(fullName: string): string {
  return "TC-" + Buffer.from(fullName).toString("base64").slice(0, 8);
}

function emptyResults(): ParsedTestRun {
  return {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    errors: 0,
    testResults: [],
  };
}
