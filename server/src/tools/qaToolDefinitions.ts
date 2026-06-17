import type Anthropic from "@anthropic-ai/sdk";

export const QA_TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: "read_implementation_files",
    description: `
Read the actual code files written by the engineering agent for this feature.
Understand implementation-level behavior before generating test cases.
Read ALL relevant implementation files before writing tests.
    `.trim(),
    input_schema: {
      type: "object" as const,
      properties: {
        file_paths: {
          type: "array",
          items: { type: "string" },
          description: "Paths of files to read, max 10 per call",
        },
        branch_name: {
          type: "string",
          description: "Branch containing the implementation",
        },
      },
      required: ["file_paths", "branch_name"],
    },
  },
  {
    name: "search_implementation",
    description: `
Semantically search the codebase for implementation patterns, error handlers,
validation logic, or middleware on a specific branch.
    `.trim(),
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string" },
        branch_name: { type: "string" },
        filter_patterns: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["query", "branch_name"],
    },
  },
  {
    name: "read_existing_tests",
    description: `
Read existing test files to understand testing patterns, utilities, fixtures,
and conventions. Call this before writing any new test files.
    `.trim(),
    input_schema: {
      type: "object" as const,
      properties: {
        branch_name: { type: "string" },
        test_type: {
          type: "string",
          enum: ["unit", "integration", "e2e", "any"],
        },
      },
      required: ["branch_name"],
    },
  },
  {
    name: "analyse_code_paths",
    description: `
Analyse a function or module to extract code paths needing test coverage:
happy paths, edge cases, error paths, security paths, concurrency paths.
    `.trim(),
    input_schema: {
      type: "object" as const,
      properties: {
        file_path: { type: "string" },
        function_name: { type: "string" },
        branch_name: { type: "string" },
      },
      required: ["file_path", "branch_name"],
    },
  },
  {
    name: "generate_test_suite",
    description: `
Generate a structured test suite plan for a module based on identified code paths
and acceptance criteria. Use write_test_file to persist executable tests.
    `.trim(),
    input_schema: {
      type: "object" as const,
      properties: {
        target_file: { type: "string" },
        test_file_path: { type: "string" },
        test_cases: {
          type: "array",
          items: { type: "object" },
        },
        branch_name: { type: "string" },
      },
      required: ["target_file", "test_file_path", "test_cases", "branch_name"],
    },
  },
  {
    name: "write_test_file",
    description: `
Write a complete, executable test file. Every test must have real assertions.
    `.trim(),
    input_schema: {
      type: "object" as const,
      properties: {
        file_path: { type: "string" },
        content: { type: "string" },
        branch_name: { type: "string" },
        commit_message: { type: "string" },
      },
      required: ["file_path", "content", "branch_name", "commit_message"],
    },
  },
  {
    name: "run_tests",
    description: `
Execute tests in an isolated sandbox. Returns pass/fail per test with errors and coverage.
    `.trim(),
    input_schema: {
      type: "object" as const,
      properties: {
        test_files: {
          type: "array",
          items: { type: "string" },
        },
        branch_name: { type: "string" },
        run_type: {
          type: "string",
          enum: ["new_tests_only", "regression_only", "full_suite"],
        },
        timeout_seconds: { type: "number" },
      },
      required: ["branch_name", "run_type"],
    },
  },
  {
    name: "analyse_test_failures",
    description: `
Analyse test failures for severity, root cause (test vs implementation), and remediation.
    `.trim(),
    input_schema: {
      type: "object" as const,
      properties: {
        failures: { type: "array", items: { type: "object" } },
        acceptance_criteria: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: ["failures", "acceptance_criteria"],
    },
  },
  {
    name: "run_security_scan",
    description: `
Run mandatory static vulnerability checks in the sandbox: npm/pnpm audit,
optional package.json security script, and security-tagged tests.
Always call this after run_tests and before generate_qa_report.
    `.trim(),
    input_schema: {
      type: "object" as const,
      properties: {
        branch_name: { type: "string" },
        timeout_seconds: { type: "number" },
      },
      required: ["branch_name"],
    },
  },
  {
    name: "generate_qa_report",
    description: `
Generate the final QA report after tests have run and failures analysed.
Call as the FINAL step before returning JSON output.
    `.trim(),
    input_schema: {
      type: "object" as const,
      properties: {
        test_results: { type: "object" },
        failure_analysis: { type: "object" },
        coverage_data: { type: "object" },
        overall_recommendation: {
          type: "string",
          enum: ["approve", "approve_with_conditions", "request_changes", "block"],
        },
        summary: { type: "string" },
      },
      required: ["test_results", "overall_recommendation", "summary"],
    },
  },
];
