import { formatToolResult } from "../agenticLoop/toolResultFormatter";
import { canaryRunRepo } from "../db/repositories/canaryRunRepo";
import { logger } from "../utils/logger";
import type { ToolCallInput, ToolCallResult } from "./executor";
import { executeQaToolCall } from "./qaToolExecutor";
import { executeSharedChatToolCall } from "./sharedChatToolExecutor";

const READ_ONLY_QA_TOOLS = new Set([
  "read_implementation_files",
  "search_implementation",
  "read_existing_tests",
  "analyse_code_paths",
]);

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export async function executeQaChatToolCall(
  toolCall: ToolCallInput,
  sessionId: string,
  contextKey: string
): Promise<ToolCallResult> {
  const shared = await executeSharedChatToolCall(toolCall);
  if (shared) return shared;

  if (toolCall.name === "get_canary_summary") {
    try {
      const runId = stringValue(toolCall.input.run_id);
      const limit = numberValue(toolCall.input.limit, 5);
      if (runId) {
        const run = await canaryRunRepo.getById(runId);
        return {
          toolUseId: toolCall.toolUseId,
          content: formatToolResult(toolCall.name, { run }),
          isError: false,
          meta: { query: runId, resultsFound: run ? 1 : 0 },
        };
      }
      const runs = await canaryRunRepo.listRecent(limit);
      return {
        toolUseId: toolCall.toolUseId,
        content: formatToolResult(toolCall.name, { runs }),
        isError: false,
        meta: { query: "recent_canary_runs", resultsFound: runs.length },
      };
    } catch (err) {
      logger.warn({ err }, "canary summary tool failed");
      return {
        toolUseId: toolCall.toolUseId,
        content: formatToolResult(toolCall.name, {
          error: err instanceof Error ? err.message : "Failed to load canary data",
        }),
        isError: true,
      };
    }
  }

  if (!READ_ONLY_QA_TOOLS.has(toolCall.name)) {
    return {
      toolUseId: toolCall.toolUseId,
      content: formatToolResult(toolCall.name, { error: `Tool not available in chat: ${toolCall.name}` }),
      isError: true,
    };
  }

  return executeQaToolCall(toolCall, sessionId, contextKey || "CHAT");
}
