import { runAgenticChatTurn } from "../agenticLoop/chatTurn";
import { getCodebaseLayerStatus } from "../codebaseIntelligence/layerStatus";
import { ANANTA_CHAT_TOOL_DEFINITIONS } from "../tools/anantaChatToolDefinitions";
import { executeAnantaChatToolCall } from "../tools/anantaChatToolExecutor";
import type { AgentChatTurnResult } from "./types";

export async function runAnantaChatTurn(input: {
  threadId: string;
  contextKey: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  userMessage: string;
}): Promise<AgentChatTurnResult> {
  const branch = input.contextKey?.trim() || "main";
  let statusBlock = "Codebase index status: unknown.";
  try {
    const status = await getCodebaseLayerStatus(branch);
    statusBlock = [
      `Branch: ${branch}`,
      `Connected: ${status.connected}`,
      `Ready: ${status.ready}`,
      `Files indexed: ${status.counts.filesIndexed}`,
      `Embeddings: ${status.counts.embeddings}`,
      status.blockers.length ? `Blockers: ${status.blockers.join("; ")}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  } catch {
    /* optional */
  }

  const systemPrompt = `You are Ananta, the tech / codebase intelligence agent for AgentOS.
Answer questions about the connected repository using your tools. Cite specific file paths.
Be concise and actionable. If the index is empty, say so and suggest indexing.

${statusBlock}`;

  const turn = await runAgenticChatTurn({
    systemPrompt,
    conversationHistory: input.conversationHistory,
    userMessage: input.userMessage,
    sessionId: input.threadId,
    contextKey: branch,
    tools: ANANTA_CHAT_TOOL_DEFINITIONS,
    executeToolCall: executeAnantaChatToolCall,
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
