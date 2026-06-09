import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { AgentParseError } from "../utils/errors";
import { logger } from "../utils/logger";
import { withRetry } from "../utils/retry";
import {
  getOpenAIChatModel,
  getOpenAIClient,
  openAIChatTokenLimit,
} from "./openaiClient";

// GPT-5.1 pricing placeholder — update when billing constants are finalized.
const INPUT_COST_PER_TOKEN = 0.00000125;
const OUTPUT_COST_PER_TOKEN = 0.00001;

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export function parseDiscoveryJson<T>(raw: string, source: string): T {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    logger.error({ source, rawPreview: raw.slice(0, 300) }, "discovery JSON parse failed");
    throw new AgentParseError(source, raw);
  }
}

export async function chatCompletionText(params: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<{ text: string; usage: LlmUsage }> {
  const response = await withRetry(
    () =>
      getOpenAIClient().chat.completions.create({
        model: getOpenAIChatModel(),
        ...openAIChatTokenLimit(params.maxTokens ?? 4000),
        messages: [
          { role: "system", content: params.system },
          { role: "user", content: params.user },
        ],
      }),
    { maxAttempts: 3, baseDelayMs: 2000, maxDelayMs: 30000 }
  );

  const text = response.choices[0]?.message?.content?.trim() ?? "";
  if (!text) {
    throw new Error("OpenAI chat completion returned empty content");
  }

  const inputTokens = response.usage?.prompt_tokens ?? 0;
  const outputTokens = response.usage?.completion_tokens ?? 0;

  return {
    text,
    usage: {
      inputTokens,
      outputTokens,
      costUsd:
        inputTokens * INPUT_COST_PER_TOKEN + outputTokens * OUTPUT_COST_PER_TOKEN,
    },
  };
}

export async function completionJson<T>(params: {
  source: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
}): Promise<{ parsed: T; usage: LlmUsage; raw: string }> {
  const { text, usage } = await chatCompletionText({
    system: params.systemPrompt,
    user: params.userPrompt,
    maxTokens: params.maxTokens,
  });

  const parsed = parseDiscoveryJson<T>(text, params.source);
  return { parsed, raw: text, usage };
}

export function mergeUsage(usages: LlmUsage[]): LlmUsage {
  return usages.reduce(
    (acc, u) => ({
      inputTokens: acc.inputTokens + u.inputTokens,
      outputTokens: acc.outputTokens + u.outputTokens,
      costUsd: acc.costUsd + u.costUsd,
    }),
    { inputTokens: 0, outputTokens: 0, costUsd: 0 }
  );
}

export type AgenticMessage = ChatCompletionMessageParam;
