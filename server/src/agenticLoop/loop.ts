import type Anthropic from "@anthropic-ai/sdk";
import { auditRepo } from "../db/repositories/auditRepo";
import { getClaudeClient, getClaudeModel } from "../llm/claudeClient";
import { executeToolCall, type ToolCallInput, type ToolCallResult } from "../tools/executor";
import { TOOL_DEFINITIONS } from "../tools/definitions";
import { logger } from "../utils/logger";
import { withRetry } from "../utils/retry";
import {
  appendAssistantResponse,
  buildToolResultMessage,
  createInitialMessages,
  extractTextContent,
  extractToolUses,
} from "./messageBuilder";

const INPUT_COST_PER_TOKEN = 0.000003;
const OUTPUT_COST_PER_TOKEN = 0.000015;
const MAX_TOOL_CALLS = 12;

export interface AgenticLoopConfig {
  systemPrompt: string;
  initialUserMessage: string;
  pipelineId: string;
  jiraKey: string;
  maxToolCalls?: number;
  tools?: typeof TOOL_DEFINITIONS;
  forcedWrapUpMessage?: string;
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
  messageHistory: Anthropic.MessageParam[];
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
    executeToolCall: executeToolCallFn = executeToolCall,
  } = config;

  const messages = createInitialMessages(initialUserMessage);
  const toolCallLog: AgenticLoopResult["toolCallLog"] = [];

  let toolCallCount = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let forcedWrapUp = false;

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

    const response = await withRetry(
      () =>
        getClaudeClient().messages.create({
          model: getClaudeModel(),
          max_tokens: 6000,
          system: systemPrompt,
          tools: forcedWrapUp ? [] : tools,
          tool_choice: forcedWrapUp ? { type: "none" } : { type: "auto" },
          messages,
        }),
      {
        maxAttempts: 3,
        baseDelayMs: 2000,
        maxDelayMs: 20000,
      }
    );

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;

    await auditRepo.log(pipelineId, "CLAUDE_RESPONSE_RECEIVED", {
      stopReason: response.stop_reason,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      contentBlocks: response.content.length,
    });

    appendAssistantResponse(messages, response.content);

    if (response.stop_reason === "end_turn" || response.stop_reason === "pause_turn") {
      const finalResponse = extractTextContent(response.content);
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

    if (response.stop_reason !== "tool_use") {
      const finalResponse = extractTextContent(response.content);
      if (finalResponse) {
        const totalCostUsd =
          totalInputTokens * INPUT_COST_PER_TOKEN +
          totalOutputTokens * OUTPUT_COST_PER_TOKEN;

        await auditRepo.log(pipelineId, "AGENTIC_LOOP_COMPLETED", {
          toolCallCount,
          totalInputTokens,
          totalOutputTokens,
          totalCostUsd,
          stopReason: response.stop_reason,
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

      throw new Error(`Unexpected stop reason in agentic loop: ${response.stop_reason}`);
    }

    const toolUses = extractToolUses(response.content);
    if (toolUses.length === 0) {
      throw new Error("Claude requested tool use but no tool_use blocks were returned.");
    }

    toolCallCount += toolUses.length;

    logger.info(
      {
        pipelineId,
        jiraKey,
        toolNames: toolUses.map((toolUse) => toolUse.name),
        toolCallCount,
      },
      "executing agentic tool calls"
    );

    const toolResults = await Promise.all(
      toolUses.map((toolUse) =>
        executeToolCallFn(
          {
            name: toolUse.name,
            input:
              typeof toolUse.input === "object" && toolUse.input !== null
                ? (toolUse.input as Record<string, unknown>)
                : {},
            toolUseId: toolUse.id,
          },
          pipelineId,
          jiraKey
        )
      )
    );

    for (const [index, result] of toolResults.entries()) {
      const toolUse = toolUses[index];
      toolCallLog.push({
        tool: toolUse.name,
        query: result.meta?.query ?? toolUse.name,
        resultsFound: result.meta?.resultsFound ?? 0,
      });
    }

    messages.push(buildToolResultMessage(toolResults));
  }
}
