import OpenAI from "openai";
import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
} from "openai/resources/chat/completions";

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

export type ChatCompletionParams = Omit<
  ChatCompletionCreateParamsNonStreaming,
  "max_tokens" | "max_completion_tokens"
> & {
  maxTokens?: number;
};

function tokenLimit(maxTokens: number): { max_completion_tokens: number } {
  return { max_completion_tokens: maxTokens };
}

/** @deprecated Prefer createChatCompletion — legacy helper name. */
export function openAIChatTokenLimit(
  maxTokens: number
): { max_completion_tokens: number } {
  return tokenLimit(maxTokens);
}

/** Alias for openAIChatTokenLimit. */
export const chatCompletionTokenLimit = openAIChatTokenLimit;

/** Single entry point — never sends legacy max_tokens (gpt-5+ rejects it). */
export async function createChatCompletion(
  params: ChatCompletionParams
): Promise<ChatCompletion> {
  const { maxTokens = 4000, ...rest } = params;
  return getOpenAIClient().chat.completions.create({
    ...rest,
    ...tokenLimit(maxTokens),
  });
}

/** Alias for createChatCompletion. */
export const createOpenAIChatCompletion = createChatCompletion;

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
