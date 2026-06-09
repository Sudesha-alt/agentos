import { chatCompletionText, parseDiscoveryJson } from "../llm/openaiCompletion";
import { MAX_CANARY_HYPOTHESES } from "./config";
import type { ApplicationUnderstanding, CanaryHypothesis } from "./types";

export async function generateHypotheses(
  understanding: ApplicationUnderstanding
): Promise<CanaryHypothesis[]> {
  const { text } = await chatCompletionText({
    system: buildHypothesisSystemPrompt(),
    user: JSON.stringify(understanding, null, 2),
    maxTokens: 4000,
  });

  const parsed = parseDiscoveryJson<{ hypotheses: CanaryHypothesis[] }>(text, "canaryHypotheses");
  const list = (parsed.hypotheses ?? []).slice(0, MAX_CANARY_HYPOTHESES);

  return list.map((h, index) => ({
    id: h.id || `H-${String(index + 1).padStart(3, "0")}`,
    priority: h.priority ?? "medium",
    title: h.title,
    reasoning: h.reasoning,
    evidence: h.evidence ?? [],
    probeScenario: h.probeScenario,
    status: "pending" as const,
  }));
}

function buildHypothesisSystemPrompt(): string {
  return `
You are a Canary QA hypothesis generator. Produce directed, testable failure hypotheses.

Think simultaneously as:
1) A developer hunting boundary/null/race/constraint bugs
2) A malicious user hunting injection/auth bypass/data leakage
3) A chaos engineer probing dependency failure and unexpected state

Return ONLY JSON:
{
  "hypotheses": [
    {
      "id": "H-001",
      "priority": "critical|high|medium|low",
      "title": "short title",
      "reasoning": "why this might fail",
      "evidence": ["evidence from recon"],
      "probeScenario": "concrete steps to prove/disprove using HTTP tools"
    }
  ]
}

Prioritize critical paths: auth, payments, concurrency, pagination, exports.
Generate 8-15 hypotheses when possible.
  `.trim();
}
