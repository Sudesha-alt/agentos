import { getClaudeClient, getClaudeModel } from "./claudeClient";
import { AgentParseError } from "../utils/errors";
import { logger } from "../utils/logger";
import { withRetry } from "../utils/retry";

const INPUT_COST_PER_TOKEN = 0.000003;
const OUTPUT_COST_PER_TOKEN = 0.000015;

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

export async function completionJson<T>(params: {
  source: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
}): Promise<{ parsed: T; usage: LlmUsage; raw: string }> {
  const response = await withRetry(
    () =>
      getClaudeClient().messages.create({
        model: getClaudeModel(),
        max_tokens: params.maxTokens ?? 4000,
        system: params.systemPrompt,
        messages: [{ role: "user", content: params.userPrompt }],
      }),
    { maxAttempts: 3, baseDelayMs: 2000, maxDelayMs: 30000 }
  );

  const block = response.content[0];
  if (!block || block.type !== "text") {
    throw new Error(`${params.source}: unexpected response type`);
  }

  const parsed = parseDiscoveryJson<T>(block.text, params.source);
  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;

  return {
    parsed,
    raw: block.text,
    usage: {
      inputTokens,
      outputTokens,
      costUsd:
        inputTokens * INPUT_COST_PER_TOKEN +
        outputTokens * OUTPUT_COST_PER_TOKEN,
    },
  };
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
