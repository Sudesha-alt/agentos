import type Anthropic from "@anthropic-ai/sdk";

export const QA_CHAT_TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: "read_implementation_files",
    description: "Read implementation source files from the repo (read-only).",
    input_schema: {
      type: "object",
      properties: {
        file_paths: { type: "array", items: { type: "string" } },
        branch_name: { type: "string" },
      },
      required: ["file_paths"],
    },
  },
  {
    name: "search_implementation",
    description: "Semantically search the codebase for implementation patterns.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string" },
        branch_name: { type: "string" },
      },
      required: ["query"],
    },
  },
  {
    name: "read_existing_tests",
    description: "Read existing test files and patterns in the repo.",
    input_schema: {
      type: "object",
      properties: {
        branch_name: { type: "string" },
        test_type: {
          type: "string",
          enum: ["unit", "integration", "e2e", "any"],
        },
      },
      required: [],
    },
  },
  {
    name: "analyse_code_paths",
    description: "Analyse code paths that need test coverage.",
    input_schema: {
      type: "object",
      properties: {
        file_path: { type: "string" },
        function_name: { type: "string" },
        branch_name: { type: "string" },
      },
      required: ["file_path"],
    },
  },
  {
    name: "get_canary_summary",
    description: "Summarize recent canary / adversarial QA runs and findings.",
    input_schema: {
      type: "object",
      properties: {
        run_id: { type: "string", description: "Optional specific run id" },
        limit: { type: "number" },
      },
      required: [],
    },
  },
];
