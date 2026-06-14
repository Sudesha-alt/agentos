import { runAgenticChatTurn } from "../agenticLoop/chatTurn";
import { QA_CHAT_TOOL_DEFINITIONS } from "../tools/qaChatToolDefinitions";
import { executeQaChatToolCall } from "../tools/qaChatToolExecutor";
import type { AgentChatTurnResult } from "./types";

export async function runQaChatTurn(input: {
  threadId: string;
  contextKey: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  userMessage: string;
}): Promise<AgentChatTurnResult> {
  const contextBlock = input.contextKey?.trim()
    ? `Active context: pipeline or ticket id "${input.contextKey}".`
    : "No specific pipeline selected — answer from general QA perspective.";

  const systemPrompt = `You are Neel, the QA agent for AgentOS.
Help users review test coverage, analyze failures, suggest test cases, and interpret canary findings.
Use read-only tools only — do not write tests or run pipelines from this chat.
Be concise and actionable.

${contextBlock}`;

  const turn = await runAgenticChatTurn({
    systemPrompt,
    conversationHistory: input.conversationHistory,
    userMessage: input.userMessage,
    sessionId: input.threadId,
    contextKey: input.contextKey || "main",
    tools: QA_CHAT_TOOL_DEFINITIONS,
    executeToolCall: executeQaChatToolCall,
    maxToolCalls: 10,
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
