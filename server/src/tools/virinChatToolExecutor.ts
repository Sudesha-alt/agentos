import { formatToolResult } from "../agenticLoop/toolResultFormatter";
import { logger } from "../utils/logger";
import { executeToolCall, type ToolCallInput, type ToolCallResult } from "./executor";
import { executeSharedChatToolCall } from "./sharedChatToolExecutor";

const VIRIN_CHAT_TOOLS = new Set([
  "lookup_jira_ticket",
  "search_historical_context",
  "fetch_related_jira_tickets",
  "analyse_requirement_completeness",
  "score_prd_readiness",
]);

export async function executeVirinChatToolCall(
  toolCall: ToolCallInput,
  sessionId: string,
  contextKey: string
): Promise<ToolCallResult> {
  const shared = await executeSharedChatToolCall(toolCall);
  if (shared) return shared;

  if (!VIRIN_CHAT_TOOLS.has(toolCall.name)) {
    return {
      toolUseId: toolCall.toolUseId,
      content: formatToolResult(toolCall.name, {
        error: `Tool not available in Virin discussion chat: ${toolCall.name}`,
      }),
      isError: true,
    };
  }

  const jiraKey =
    toolCall.name === "fetch_related_jira_tickets"
      ? String(toolCall.input.jira_key ?? contextKey ?? "CHAT")
      : contextKey?.trim() || "CHAT";

  try {
    return await executeToolCall(toolCall, sessionId, jiraKey);
  } catch (err) {
    logger.warn({ err, tool: toolCall.name }, "virin chat tool failed");
    return {
      toolUseId: toolCall.toolUseId,
      content: formatToolResult(toolCall.name, {
        error: err instanceof Error ? err.message : "Tool failed",
      }),
      isError: true,
    };
  }
}
