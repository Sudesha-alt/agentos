import { chatCompletionText } from "../llm/openaiCompletion";
import type { CanaryExplorationOutput, CanaryFindingDraft } from "./types";

export async function synthesizeReport(input: {
  exploration: CanaryExplorationOutput;
  jiraKey?: string;
}): Promise<{ summary: string; findings: CanaryFindingDraft[] }> {
  const findings = input.exploration.findings;

  if (findings.length === 0) {
    return {
      summary:
        "Canary exploration completed with no confirmed findings. Hypotheses were probed against the running application.",
      findings: [],
    };
  }

  const { text } = await chatCompletionText({
    system: "Write a concise engineering lead summary (3-5 sentences) of Canary findings.",
    user: JSON.stringify({ jiraKey: input.jiraKey, findings }, null, 2),
    maxTokens: 600,
  });

  return {
    summary: text.trim(),
    findings,
  };
}
