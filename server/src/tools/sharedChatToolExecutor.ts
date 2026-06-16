import { lookupJiraTicketForChat } from "../agentChat/ticketLookup";
import { formatToolResult } from "../agenticLoop/toolResultFormatter";
import type { ToolCallInput, ToolCallResult } from "./executor";

function stringValue(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export async function executeLookupJiraTicketTool(
  toolCall: ToolCallInput
): Promise<ToolCallResult> {
  const jiraKey = stringValue(toolCall.input.jira_key);
  const result = await lookupJiraTicketForChat(jiraKey);
  return {
    toolUseId: toolCall.toolUseId,
    content: formatToolResult(toolCall.name, result),
    isError: false,
    meta: {
      query: jiraKey,
      resultsFound: result.found ? 1 : 0,
    },
  };
}

export async function executeSharedChatToolCall(
  toolCall: ToolCallInput
): Promise<ToolCallResult | null> {
  if (toolCall.name === "lookup_jira_ticket") {
    return executeLookupJiraTicketTool(toolCall);
  }
  return null;
}
