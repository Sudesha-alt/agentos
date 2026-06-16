import { pmAnalysisStore } from "../agents/pm/store";
import { buildAgentChatSystemPrompt } from "./chatPrompts";
import { lookupJiraTicketForChat } from "./ticketLookup";
import { runAgenticChatTurn } from "../agenticLoop/chatTurn";
import { companyIntelligence } from "../companyIntelligence";
import { VIRIN_CHAT_TOOL_DEFINITIONS } from "../tools/virinChatToolDefinitions";
import { executeVirinChatToolCall } from "../tools/virinChatToolExecutor";
import type { AgentChatTurnResult } from "./types";

async function buildVirinContextBlock(contextKey: string): Promise<string> {
  let companyBlock = "Company profile: not configured.";
  try {
    const profile = await companyIntelligence.getProfile();
    companyBlock = companyIntelligence.toPromptBlock(profile);
  } catch {
    /* optional */
  }

  const blocks = [companyBlock];

  if (contextKey?.trim()) {
    const record = pmAnalysisStore.get(contextKey);
    if (record) {
      blocks.push(
        [
          `Active ticket: ${record.jiraKey}`,
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
          .join("\n")
      );
    } else {
      const ticket = await lookupJiraTicketForChat(contextKey);
      if (ticket.found) {
        blocks.push(
          [
            `Active ticket: ${ticket.jiraKey}`,
            ticket.summary ? `Summary: ${ticket.summary}` : "",
            ticket.status ? `Status: ${ticket.status}` : "",
          ]
            .filter(Boolean)
            .join("\n")
        );
      }
    }
  }

  return blocks.join("\n\n");
}

export async function runVirinChatTurn(input: {
  threadId: string;
  contextKey: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  userMessage: string;
}): Promise<AgentChatTurnResult> {
  const jiraKey = input.contextKey?.trim() || "CHAT";
  const contextBlock = await buildVirinContextBlock(input.contextKey);

  const systemPrompt = buildAgentChatSystemPrompt({
    domain: "virin",
    contextBlock,
  });

  const turn = await runAgenticChatTurn({
    systemPrompt,
    conversationHistory: input.conversationHistory,
    userMessage: input.userMessage,
    sessionId: input.threadId,
    contextKey: jiraKey,
    tools: VIRIN_CHAT_TOOL_DEFINITIONS,
    executeToolCall: executeVirinChatToolCall,
    maxToolCalls: 8,
    forcedWrapUpMessage:
      "Stop calling tools. Answer in first person as Virin, discussion-only.",
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
