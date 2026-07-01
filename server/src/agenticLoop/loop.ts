import { auditRepo } from "../db/repositories/auditRepo";
import type { ChatCompletionMessageToolCall } from "openai/resources/chat/completions";
import { createChatCompletion, getOpenAIChatModel } from "../llm/openaiClient";
import type { AgenticMessage } from "../llm/openaiCompletion";
import { anthropicToolsToOpenAI } from "../llm/openaiTools";
import { executeToolCall, type ToolCallInput, type ToolCallResult } from "../tools/executor";
import { TOOL_DEFINITIONS } from "../tools/definitions";
import { logger } from "../utils/logger";
import { withRetry } from "../utils/retry";
import {
  buildToolResultMessages,
  createInitialMessages,
  extractTextContent,
} from "./messageBuilder";

const INPUT_COST_PER_TOKEN = 0.00000125;
const OUTPUT_COST_PER_TOKEN = 0.00001;
const MAX_TOOL_CALLS = 12;

export const MUTATING_CODING_TOOLS = new Set([
  "write_file",
  "write_source_file",
  "edit_file",
  "delete_file",
]);

export interface AgenticLoopConfig {
  systemPrompt: string;
  initialUserMessage: string;
  pipelineId: string;
  jiraKey: string;
  maxToolCalls?: number;
  tools?: typeof TOOL_DEFINITIONS;
  forcedWrapUpMessage?: string;
  /** Require at least one mutating tool call before the loop may finish */
  requireMutatingToolCalls?: boolean;
  mutatingToolNames?: Set<string>;
  maxMutatingToolRetries?: number;
  mutatingToolRetryMessage?: string;
  executeToolCall?: (
    toolCall: ToolCallInput,
    pipelineId: string,
    jiraKey: string
  ) => Promise<ToolCallResult>;
}

export interface AgenticLoopResult {
  finalResponse: string;
  toolCallCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  messageHistory: AgenticMessage[];
  toolCallLog: Array<{
    tool: string;
    query: string;
    resultsFound: number;
  }>;
}

export async function runAgenticLoop(
  config: AgenticLoopConfig
): Promise<AgenticLoopResult> {
  const {
    systemPrompt,
    initialUserMessage,
    pipelineId,
    jiraKey,
    maxToolCalls = MAX_TOOL_CALLS,
    tools = TOOL_DEFINITIONS,
    forcedWrapUpMessage,
    requireMutatingToolCalls = false,
    mutatingToolNames = MUTATING_CODING_TOOLS,
    maxMutatingToolRetries = 2,
    mutatingToolRetryMessage,
    executeToolCall: executeToolCallFn = executeToolCall,
  } = config;

  const messages = createInitialMessages(initialUserMessage);
  const openaiTools = anthropicToolsToOpenAI(tools);
  const toolCallLog: AgenticLoopResult["toolCallLog"] = [];

  let toolCallCount = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let forcedWrapUp = false;
  let mutatingRetryCount = 0;

  function hasMutatingToolCall(): boolean {
    return toolCallLog.some((entry) => mutatingToolNames.has(entry.tool));
  }

  await auditRepo.log(pipelineId, "AGENTIC_LOOP_STARTED", {
    jiraKey,
    maxToolCalls,
  });

  while (true) {
    if (toolCallCount >= maxToolCalls && !forcedWrapUp) {
      messages.push({
        role: "user",
        content:
          forcedWrapUpMessage ??
          `You have already used ${toolCallCount} tool calls. Produce the final output now using the information gathered so far. Do not call any more tools.`,
      });
      forcedWrapUp = true;
    }

    const model = getOpenAIChatModel();
    const response = await withRetry(
      () =>
        createChatCompletion({
          model,
          maxTokens: 6000,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          tools: forcedWrapUp ? undefined : openaiTools,
          tool_choice: forcedWrapUp ? "none" : "auto",
        }),
      {
        maxAttempts: 3,
        baseDelayMs: 2000,
        maxDelayMs: 20000,
      }
    );

    totalInputTokens += response.usage?.prompt_tokens ?? 0;
    totalOutputTokens += response.usage?.completion_tokens ?? 0;

    const choice = response.choices[0];
    if (!choice?.message) {
      throw new Error("Agentic loop received empty model response.");
    }

    await auditRepo.log(pipelineId, "LLM_RESPONSE_RECEIVED", {
      finishReason: choice.finish_reason,
      inputTokens: response.usage?.prompt_tokens ?? 0,
      outputTokens: response.usage?.completion_tokens ?? 0,
      toolCalls: choice.message.tool_calls?.length ?? 0,
    });

    const toolCalls = choice.message.tool_calls ?? [];

    if (choice.finish_reason === "stop" || toolCalls.length === 0) {
      if (
        requireMutatingToolCalls &&
        !hasMutatingToolCall() &&
        mutatingRetryCount < maxMutatingToolRetries
      ) {
        mutatingRetryCount += 1;
        forcedWrapUp = false;
        messages.push({
          role: "user",
          content:
            mutatingToolRetryMessage ??
            "You have not modified any files yet. You MUST call edit_file or write_file on at least one repo file before returning your final JSON. Use grep or list_dir if you still need to locate the right paths, then implement.",
        });
        continue;
      }

      const finalResponse = extractTextContent(choice.message);
      if (!finalResponse) {
        throw new Error("Agentic loop ended without a text response.");
      }

      const totalCostUsd =
        totalInputTokens * INPUT_COST_PER_TOKEN +
        totalOutputTokens * OUTPUT_COST_PER_TOKEN;

      await auditRepo.log(pipelineId, "AGENTIC_LOOP_COMPLETED", {
        toolCallCount,
        totalInputTokens,
        totalOutputTokens,
        totalCostUsd,
      });

      return {
        finalResponse,
        toolCallCount,
        totalInputTokens,
        totalOutputTokens,
        totalCostUsd,
        messageHistory: messages,
        toolCallLog,
      };
    }

    messages.push(choice.message);

    toolCallCount += toolCalls.length;

    logger.info(
      {
        pipelineId,
        jiraKey,
        toolNames: toolCalls.map((tc: ChatCompletionMessageToolCall) => tc.function.name),
        toolCallCount,
      },
      "executing agentic tool calls"
    );

    const toolResults = await Promise.all(
      toolCalls.map((toolCall: ChatCompletionMessageToolCall) => {
        let input: Record<string, unknown> = {};
        try {
          input = JSON.parse(toolCall.function.arguments || "{}") as Record<string, unknown>;
        } catch {
          input = {};
        }

        return executeToolCallFn(
          {
            name: toolCall.function.name,
            input,
            toolUseId: toolCall.id,
          },
          pipelineId,
          jiraKey
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
