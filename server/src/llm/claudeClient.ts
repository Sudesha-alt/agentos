/**
 * @deprecated AgentOS uses OpenAI GPT-5.1 for all chat completions.
 * Import from `./openaiClient` and `./openaiCompletion` instead.
 */
import { getOpenAIChatModel, getOpenAIClient } from "./openaiClient";

export type ClaudeClient = ReturnType<typeof getOpenAIClient>;

/** @deprecated Use getOpenAIClient() */
export function getClaudeClient(): ClaudeClient {
  return getOpenAIClient();
}

/** @deprecated Use getOpenAIChatModel() */
export function getClaudeModel(): string {
  return getOpenAIChatModel();
}
