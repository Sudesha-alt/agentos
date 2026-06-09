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

/** GPT-5 / o-series models reject `max_tokens`; use `max_completion_tokens` instead. */
export function openAIChatTokenLimit(
  maxTokens: number
): { max_tokens: number } | { max_completion_tokens: number } {
  const model = getOpenAIChatModel().toLowerCase();
  const usesCompletionTokens =
    model.startsWith("gpt-5") ||
    model.startsWith("o1") ||
    model.startsWith("o3") ||
    model.startsWith("o4");
  return usesCompletionTokens
    ? { max_completion_tokens: maxTokens }
    : { max_tokens: maxTokens };
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
