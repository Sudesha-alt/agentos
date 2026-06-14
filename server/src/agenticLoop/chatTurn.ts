import type { ChatCompletionMessageToolCall } from "openai/resources/chat/completions";
import type Anthropic from "@anthropic-ai/sdk";
import { createChatCompletion, getOpenAIChatModel } from "../llm/openaiClient";
import type { AgenticMessage } from "../llm/openaiCompletion";
import { anthropicToolsToOpenAI } from "../llm/openaiTools";
import type { ToolCallInput, ToolCallResult } from "../tools/executor";
import { logger } from "../utils/logger";
import { withRetry } from "../utils/retry";
import { buildToolResultMessages, extractTextContent } from "./messageBuilder";

const INPUT_COST_PER_TOKEN = 0.00000125;
const OUTPUT_COST_PER_TOKEN = 0.00001;
const DEFAULT_MAX_TOOL_CALLS = 12;

export interface AgenticChatTurnConfig {
  systemPrompt: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  userMessage: string;
  sessionId: string;
  contextKey?: string;
  maxToolCalls?: number;
  tools: Anthropic.Tool[];
  executeToolCall: (
    toolCall: ToolCallInput,
    sessionId: string,
    contextKey: string
  ) => Promise<ToolCallResult>;
  forcedWrapUpMessage?: string;
}

export interface AgenticChatTurnResult {
  assistantMessage: string;
  toolCallCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  costUsd: number;
  toolCallLog: Array<{ tool: string; query: string; resultsFound: number }>;
}

export async function runAgenticChatTurn(
  config: AgenticChatTurnConfig
): Promise<AgenticChatTurnResult> {
  const {
    systemPrompt,
    conversationHistory,
    userMessage,
    sessionId,
    contextKey = "",
    maxToolCalls = DEFAULT_MAX_TOOL_CALLS,
    tools,
    executeToolCall: executeToolCallFn,
    forcedWrapUpMessage,
  } = config;

  const messages: AgenticMessage[] = [
    ...conversationHistory.map(
      (m): AgenticMessage => ({ role: m.role, content: m.content })
    ),
    { role: "user", content: userMessage },
  ];

  const openaiTools = anthropicToolsToOpenAI(tools);
  const toolCallLog: AgenticChatTurnResult["toolCallLog"] = [];

  let toolCallCount = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let forcedWrapUp = false;

  logger.info({ sessionId, contextKey, domain: "agent-chat" }, "agent chat turn started");

  while (true) {
    if (toolCallCount >= maxToolCalls && !forcedWrapUp) {
      messages.push({
        role: "user",
        content:
          forcedWrapUpMessage ??
          `You have used ${toolCallCount} tool calls. Answer now using gathered information. Do not call more tools.`,
      });
      forcedWrapUp = true;
    }

    const model = getOpenAIChatModel();
    const response = await withRetry(
      () =>
        createChatCompletion({
          model,
          maxTokens: 4000,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          tools: forcedWrapUp ? undefined : openaiTools,
          tool_choice: forcedWrapUp ? "none" : "auto",
        }),
      { maxAttempts: 3, baseDelayMs: 2000, maxDelayMs: 20000 }
    );

    totalInputTokens += response.usage?.prompt_tokens ?? 0;
    totalOutputTokens += response.usage?.completion_tokens ?? 0;

    const choice = response.choices[0];
    if (!choice?.message) {
      throw new Error("Agent chat turn received empty model response.");
    }

    const toolCalls = choice.message.tool_calls ?? [];

    if (choice.finish_reason === "stop" || toolCalls.length === 0) {
      const assistantMessage = extractTextContent(choice.message);
      if (!assistantMessage) {
        throw new Error("Agent chat turn ended without a text response.");
      }

      const costUsd =
        totalInputTokens * INPUT_COST_PER_TOKEN +
        totalOutputTokens * OUTPUT_COST_PER_TOKEN;

      logger.info(
        { sessionId, toolCallCount, costUsd },
        "agent chat turn completed"
      );

      return {
        assistantMessage,
        toolCallCount,
        totalInputTokens,
        totalOutputTokens,
        costUsd,
        toolCallLog,
      };
    }

    messages.push(choice.message);
    toolCallCount += toolCalls.length;

    const toolResults = await Promise.all(
      toolCalls.map((toolCall: ChatCompletionMessageToolCall) => {
        let input: Record<string, unknown> = {};
        try {
          input = JSON.parse(toolCall.function.arguments || "{}") as Record<
            string,
            unknown
          >;
        } catch {
          input = {};
        }
        return executeToolCallFn(
          {
            name: toolCall.function.name,
            input,
            toolUseId: toolCall.id,
          },
          sessionId,
          contextKey
        );
      })
    );

    for (const [index, result] of toolResults.entries()) {
      const toolCall = toolCalls[index];
      toolCallLog.push({
        tool: toolCall.function.name,
        query: result.meta?.query ?? toolCall.function.name,
        resultsFound: result.meta?.resultsFound ?? 0,
      });
    }

    messages.push(...buildToolResultMessages(toolResults));
  }
}
