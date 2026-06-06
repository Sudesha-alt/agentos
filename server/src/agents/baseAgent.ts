import { auditRepo } from "../db/repositories/auditRepo";
import { chatCompletionText } from "../llm/openaiCompletion";
import { getOpenAIChatModel } from "../llm/openaiClient";
import type { AgentOutput } from "../types/agents";
import { AgentParseError } from "../utils/errors";
import { logger } from "../utils/logger";
import { retry } from "../utils/retry";

const INPUT_COST_PER_TOKEN = 0.00000125;
const OUTPUT_COST_PER_TOKEN = 0.00001;

export abstract class BaseAgent<TParsed = Record<string, unknown>> {
  abstract name: string;
  abstract systemPrompt: string;
  protected model = getOpenAIChatModel();
  protected maxTokens = 4000;

  async run(pipelineId: string, userPrompt: string): Promise<AgentOutput<TParsed>> {
    const startTime = Date.now();

    await auditRepo.log(pipelineId, `${this.name}_STARTED`, {
      promptLength: userPrompt.length,
    });

    const { text, usage } = await retry(
      () =>
        chatCompletionText({
          system: this.systemPrompt,
          user: userPrompt,
          maxTokens: this.maxTokens,
        }),
      { attempts: 3, baseDelayMs: 1200 }
    );

    const parsed = this.parseOutput(text);
    const durationMs = Date.now() - startTime;
    const inputTokens = usage.inputTokens;
    const outputTokens = usage.outputTokens;
    const costUsd = usage.costUsd;

    await auditRepo.log(pipelineId, `${this.name}_COMPLETED`, {
      inputTokens,
      outputTokens,
      costUsd,
      durationMs,
      model: this.model,
    });

    logger.info(
      { agent: this.name, model: this.model, inputTokens, outputTokens, costUsd, durationMs },
      "agent run"
    );

    return {
      raw: text,
      parsed,
      metadata: { inputTokens, outputTokens, costUsd, durationMs },
    };
  }

  protected safeJsonParse(raw: string): unknown {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      throw new AgentParseError(this.name, raw);
    }
  }

  abstract parseOutput(raw: string): TParsed;
}
