import type Anthropic from "@anthropic-ai/sdk";

export const ENGINEERING_CODING_TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: "read_source_file",
    description: `
Read source file contents from the repository branch before making changes.
Always read affected files before modifying them.
    `.trim(),
    input_schema: {
      type: "object" as const,
      properties: {
        file_path: { type: "string" },
        branch_name: { type: "string" },
      },
      required: ["file_path", "branch_name"],
    },
  },
  {
    name: "search_codebase",
    description: `
Semantically search the codebase for patterns, utilities, types, or similar implementations
relevant to the change. Use before writing new code.
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
    name: "write_source_file",
    description: `
Stage a complete source file change (create or modify). Provide the full file content.
Changes are staged locally for the pipeline — not pushed to GitHub yet.
    `.trim(),
    input_schema: {
      type: "object" as const,
      properties: {
        file_path: { type: "string" },
        content: { type: "string" },
        branch_name: { type: "string" },
        action: {
          type: "string",
          enum: ["create", "modify"],
        },
        summary: {
          type: "string",
          description: "One-line description of what changed",
        },
      },
      required: ["file_path", "content", "branch_name", "action", "summary"],
    },
  },
];
