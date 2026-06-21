import { Agent, fetch as undiciFetch } from "node:undici";
import OpenAI from "openai";
import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
} from "openai/resources/chat/completions";

let cached: OpenAI | undefined;
let openaiDispatcher: Agent | undefined;

/** Drop cached client after connection errors so the next call opens a fresh socket. */
export function resetOpenAIClient(): void {
  cached = undefined;
  void openaiDispatcher?.close();
  openaiDispatcher = undefined;
}

/** Fresh TCP per request — avoids stale keep-alive gzip streams on Render. */
function openaiFetch(url: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (!openaiDispatcher) {
    openaiDispatcher = new Agent({
      pipelining: 0,
      keepAliveTimeout: 1,
      keepAliveMaxTimeout: 1,
    });
  }
  return undiciFetch(url, {
    ...init,
    dispatcher: openaiDispatcher,
  }) as unknown as Promise<Response>;
}

export const DEFAULT_OPENAI_CHAT_MODEL = "gpt-5.1";
/** One-off / high-stakes tasks (company profile synthesis, etc.). */
export const DEFAULT_OPENAI_PREMIUM_MODEL = "gpt-5.5";

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

/** Premium model for rare, high-quality synthesis (company business context). */
export function getOpenAIPremiumModel(): string {
  return (
    sanitizeModelName(process.env.OPENAI_PREMIUM_MODEL) ||
    sanitizeModelName(process.env.OPENAI_COMPANY_CONTEXT_MODEL) ||
    DEFAULT_OPENAI_PREMIUM_MODEL
  );
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

  cached = new OpenAI({
    apiKey,
    timeout: 120_000,
    maxRetries: 0,
    fetch: openaiFetch,
  });
  return cached;
}
