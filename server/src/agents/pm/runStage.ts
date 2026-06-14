import { completionJson } from "../../llm/openaiCompletion";
import { isOpenAIConfigured } from "../../llm/openaiClient";
import type { LlmUsage } from "../../llm/openaiCompletion";
import type { PmStageId } from "./types";

export async function runPmStage<T>(input: {
  stage: PmStageId;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
}): Promise<{ parsed: T; usage: LlmUsage; raw: string }> {
  if (!isOpenAIConfigured()) {
    throw new Error("OPENAI_API_KEY is required for PM agent analysis");
  }

  const { parsed, usage, raw } = await completionJson<T>({
    source: `virin_${input.stage}`,
    systemPrompt: input.systemPrompt,
    userPrompt: input.userPrompt,
    maxTokens: input.maxTokens ?? 4000,
  });

  return { parsed, usage, raw };
}
