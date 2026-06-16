import { runAgenticChatTurn } from "../agenticLoop/chatTurn";
import { QA_CHAT_TOOL_DEFINITIONS } from "../tools/qaChatToolDefinitions";
import { executeQaChatToolCall } from "../tools/qaChatToolExecutor";
import { buildAgentChatSystemPrompt } from "./chatPrompts";
import { lookupJiraTicketForChat } from "./ticketLookup";
import type { AgentChatTurnResult } from "./types";

async function buildQaContextBlock(contextKey: string): Promise<string> {
  if (!contextKey?.trim()) {
    return "No pipeline or canary run selected — answer from general QA perspective.";
  }

  const lines = [`Active context id: ${contextKey}`];

  if (/^[A-Z]+-\d+$/i.test(contextKey.trim())) {
    const ticket = await lookupJiraTicketForChat(contextKey);
    if (ticket.found) {
      lines.push(
        `Linked ticket ${ticket.jiraKey}: ${ticket.summary ?? ""}`,
        ticket.status ? `Status: ${ticket.status}` : ""
      );
    }
  }

  return lines.filter(Boolean).join("\n");
}

export async function runQaChatTurn(input: {
  threadId: string;
  contextKey: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  userMessage: string;
}): Promise<AgentChatTurnResult> {
  const contextBlock = await buildQaContextBlock(input.contextKey);

  const systemPrompt = buildAgentChatSystemPrompt({
    domain: "neel",
    contextBlock,
  });

  const turn = await runAgenticChatTurn({
    systemPrompt,
    conversationHistory: input.conversationHistory,
    userMessage: input.userMessage,
    sessionId: input.threadId,
    contextKey: input.contextKey || "main",
    tools: QA_CHAT_TOOL_DEFINITIONS,
    executeToolCall: executeQaChatToolCall,
    maxToolCalls: 10,
    forcedWrapUpMessage:
      "Stop calling tools. Answer in first person as Neel, discussion-only.",
  });

  return {
    assistantMessage: {
      id: "",
      role: "assistant",
      content: turn.assistantMessage,
      metadata: {
        toolCallLog: turn.toolCallLog,
        costUsd: turn.costUsd,
        toolCallCount: turn.toolCallCount,
      },
      createdAt: new Date().toISOString(),
    },
    toolCallLog: turn.toolCallLog,
    costUsd: turn.costUsd,
  };
}
