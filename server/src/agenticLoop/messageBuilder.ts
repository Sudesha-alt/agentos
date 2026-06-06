import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { ToolCallResult } from "../tools/executor";

export type AgenticMessage = ChatCompletionMessageParam;

export function createInitialMessages(initialUserMessage: string): AgenticMessage[] {
  return [{ role: "user", content: initialUserMessage }];
}

export function buildToolResultMessages(results: ToolCallResult[]): AgenticMessage[] {
  return results.map((result) => ({
    role: "tool",
    tool_call_id: result.toolUseId,
    content: result.content,
  }));
}

export function extractTextContent(message: {
  content?: string | null;
  tool_calls?: Array<{ id: string; type: string }>;
}): string {
  return message.content?.trim() ?? "";
}
