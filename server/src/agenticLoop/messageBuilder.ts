import type Anthropic from "@anthropic-ai/sdk";
import type { ToolCallResult } from "../tools/executor";

export function createInitialMessages(
  initialUserMessage: string
): Anthropic.MessageParam[] {
  return [{ role: "user", content: initialUserMessage }];
}

export function appendAssistantResponse(
  messages: Anthropic.MessageParam[],
  content: Anthropic.Message["content"]
): void {
  messages.push({
    role: "assistant",
    content,
  });
}

export function buildToolResultMessage(
  results: ToolCallResult[]
): Anthropic.MessageParam {
  return {
    role: "user",
    content: results.map((result) => ({
      type: "tool_result" as const,
      tool_use_id: result.toolUseId,
      content: result.content,
      is_error: result.isError,
    })),
  };
}

export function extractToolUses(
  content: Anthropic.Message["content"]
): Anthropic.ToolUseBlock[] {
  return content.filter((block): block is Anthropic.ToolUseBlock => {
    return block.type === "tool_use";
  });
}

export function extractTextContent(
  content: Anthropic.Message["content"]
): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}
