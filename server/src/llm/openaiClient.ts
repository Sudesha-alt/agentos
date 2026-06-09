import OpenAI from "openai";

let cached: OpenAI | undefined;

export const DEFAULT_OPENAI_CHAT_MODEL = "gpt-5.1";

export function isOpenAIConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

/** Primary chat model for agents, ask, tour, summaries, and discovery. */
export function getOpenAIChatModel(): string {
  return (
    process.env.OPENAI_CHAT_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    process.env.OPENAI_SUMMARY_MODEL?.trim() ||
    DEFAULT_OPENAI_CHAT_MODEL
  );
}

/** Chat model for per-file codebase summaries during indexing. */
export function getOpenAISummaryModel(): string {
  return getOpenAIChatModel();
}

/** Newer chat models reject `max_tokens` and require `max_completion_tokens`. */
export function usesMaxCompletionTokens(model?: string): boolean {
  const name = (model ?? getOpenAIChatModel()).toLowerCase();
  return /^gpt-5/.test(name) || /^o\d/.test(name);
}

export function chatCompletionTokenLimit(
  maxTokens: number,
  model?: string
): { max_tokens: number } | { max_completion_tokens: number } {
  if (usesMaxCompletionTokens(model)) {
    return { max_completion_tokens: maxTokens };
  }
  return { max_tokens: maxTokens };
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
