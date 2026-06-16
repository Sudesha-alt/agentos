import type Anthropic from "@anthropic-ai/sdk";
import { LOOKUP_JIRA_TICKET_TOOL } from "./sharedChatToolDefinitions";

export const ANANTA_CHAT_TOOL_DEFINITIONS: Anthropic.Tool[] = [
  LOOKUP_JIRA_TICKET_TOOL,
  {
    name: "search_codebase",
    description:
      "Semantically search the indexed codebase for files and snippets relevant to a natural-language query.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural language search query" },
        branch_name: { type: "string", description: "Git branch (default main)" },
        top_k: { type: "number", description: "Max results (default 8)" },
      },
      required: ["query"],
    },
  },
  {
    name: "list_directory",
    description: "List files and subdirectories at a path in the repo.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Directory path (empty for root)" },
        branch_name: { type: "string" },
      },
      required: [],
    },
  },
  {
    name: "read_file",
    description: "Read file intelligence and optional content from the codebase index.",
    input_schema: {
      type: "object",
      properties: {
        file_path: { type: "string" },
        branch_name: { type: "string" },
        include_content: { type: "boolean" },
      },
      required: ["file_path"],
    },
  },
  {
    name: "get_architecture_doc",
    description: "Fetch the generated architecture overview for the repo.",
    input_schema: {
      type: "object",
      properties: {
        branch_name: { type: "string" },
      },
      required: [],
    },
  },
  {
    name: "get_runbook",
    description: "Fetch an operational runbook for a task (deploy, debug, onboard, etc.).",
    input_schema: {
      type: "object",
      properties: {
        task: { type: "string" },
        branch_name: { type: "string" },
      },
      required: ["task"],
    },
  },
  {
    name: "get_codebase_health",
    description: "Summarize codebase health metrics (complexity, hotspots, drift).",
    input_schema: {
      type: "object",
      properties: {
        branch_name: { type: "string" },
      },
      required: [],
    },
  },
  {
    name: "analyze_impact",
    description: "Analyze blast radius if a file or symbol changes.",
    input_schema: {
      type: "object",
      properties: {
        file_path: { type: "string" },
        branch_name: { type: "string" },
      },
      required: ["file_path"],
    },
  },
];
