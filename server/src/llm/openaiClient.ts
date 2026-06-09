import OpenAI from "openai";
import type { ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat/completions";

let cached: OpenAI | undefined;

export const DEFAULT_OPENAI_CHAT_MODEL = "gpt-5.1";

function sanitizeModelName(raw: string | undefined): string {
  if (!raw) return "";
  return raw.replace(/^\uFEFF/, "").replace(/^["']|["']$/g, "").trim();
}

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/** Primary chat model for agents, ask, tour, summaries, and discovery. */
export function getOpenAIChatModel(): string {
  return (
    sanitizeModelName(process.env.OPENAI_CHAT_MODEL) ||
    sanitizeModelName(process.env.OPENAI_MODEL) ||
    sanitizeModelName(process.env.OPENAI_SUMMARY_MODEL) ||
    DEFAULT_OPENAI_CHAT_MODEL
  );
}

/** Chat model for per-file codebase summaries during indexing. */
export function getOpenAISummaryModel(): string {
  return getOpenAIChatModel();
}

/** OpenAI chat completions — always use max_completion_tokens (gpt-5+ rejects max_tokens). */
export function openAIChatTokenLimit(
  maxTokens: number
): { max_completion_tokens: number } {
  return { max_completion_tokens: maxTokens };
}

/** Lazy OpenAI client — server boot must not require OPENAI_API_KEY. */
export function getOpenAIClient(): OpenAI {
  if (cached) return cached;

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is required for GPT chat, embeddings, and semantic codebase search"
    );
  }

  cached = new OpenAI({ apiKey });
  return cached;
}
