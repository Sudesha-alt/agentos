import { pmAnalysisStore } from "../agents/pm/store";
import { runAgenticChatTurn } from "../agenticLoop/chatTurn";
import { companyIntelligence } from "../companyIntelligence";
import { executeToolCall } from "../tools/executor";
import { TOOL_DEFINITIONS } from "../tools/definitions";
import type { AgentChatTurnResult } from "./types";

export async function runVirinChatTurn(input: {
  threadId: string;
  contextKey: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  userMessage: string;
}): Promise<AgentChatTurnResult> {
  const jiraKey = input.contextKey?.trim() || "CHAT";
  let companyBlock = "Company profile: not configured.";
  try {
    const profile = await companyIntelligence.getProfile();
    companyBlock = companyIntelligence.toPromptBlock(profile);
  } catch {
    /* optional */
  }

  let ticketBlock = "No active ticket analysis.";
  if (input.contextKey?.trim()) {
    const record = pmAnalysisStore.get(input.contextKey);
    if (record) {
      ticketBlock = [
        `Ticket: ${record.jiraKey}`,
        `Status: ${record.status}`,
        `Stage: ${record.currentStage ?? "—"}`,
        record.questionMode?.discoverySummary
          ? `Discovery summary: ${record.questionMode.discoverySummary}`
          : "",
        record.competitorAnalysis?.summaryMarkdown
          ? `Competitor analysis: ${record.competitorAnalysis.summaryMarkdown.slice(0, 800)}`
          : "",
      ]
        .filter(Boolean)
        .join("\n");
    }
  }

  const systemPrompt = `You are Virin, the product discovery agent for AgentOS.
Help the user explore product questions, historical precedents, Jira context, and requirement quality.
Use tools when you need historical tickets, related Jira issues, or validation checks.
Be concise. This is exploratory chat — not the formal discovery gate.

${companyBlock}

${ticketBlock}`;

  const turn = await runAgenticChatTurn({
    systemPrompt,
    conversationHistory: input.conversationHistory,
    userMessage: input.userMessage,
    sessionId: input.threadId,
    contextKey: jiraKey,
    tools: TOOL_DEFINITIONS,
    executeToolCall: (toolCall, sessionId, ctxKey) =>
      executeToolCall(toolCall, sessionId, ctxKey),
    maxToolCalls: 8,
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
