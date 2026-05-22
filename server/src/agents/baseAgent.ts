import { auditRepo } from "../db/repositories/auditRepo";
import { getClaudeClient, getClaudeModel } from "../llm/claudeClient";
import type { AgentOutput } from "../types/agents";
import { AgentParseError } from "../utils/errors";
import { logger } from "../utils/logger";
import { retry } from "../utils/retry";

// Claude Sonnet 4 pricing per token (May 2025): $3/Mtok input, $15/Mtok output.
const INPUT_COST_PER_TOKEN = 0.000003;
const OUTPUT_COST_PER_TOKEN = 0.000015;

export abstract class BaseAgent<TParsed = Record<string, unknown>> {
  abstract name: string;
  abstract systemPrompt: string;
  protected model = getClaudeModel();
  protected maxTokens = 4000;

  async run(pipelineId: string, userPrompt: string): Promise<AgentOutput<TParsed>> {
    const startTime = Date.now();

    await auditRepo.log(pipelineId, `${this.name}_STARTED`, {
      promptLength: userPrompt.length,
    });

    const response = await retry(
      () =>
        getClaudeClient().messages.create({
          model: this.model,
          max_tokens: this.maxTokens,
          system: this.systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        }),
      { attempts: 3, baseDelayMs: 1200 }
    );

    const content = response.content[0];
    if (!content || content.type !== "text") {
      throw new Error(`${this.name}: unexpected response type`);
    }

    const parsed = this.parseOutput(content.text);
    const durationMs = Date.now() - startTime;
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const costUsd =
      inputTokens * INPUT_COST_PER_TOKEN +
      outputTokens * OUTPUT_COST_PER_TOKEN;

    await auditRepo.log(pipelineId, `${this.name}_COMPLETED`, {
      inputTokens,
      outputTokens,
      costUsd,
      durationMs,
    });

    logger.info(
      { agent: this.name, inputTokens, outputTokens, costUsd, durationMs },
      "agent run"
    );

    return {
      raw: content.text,
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
