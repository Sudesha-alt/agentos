import { completionJson } from "../llm/discoveryCompletion";
import type { RetrievedContext } from "../types/pipeline";
import type { TicketAnalysis } from "./ticketAnalyser";
import { logger } from "../utils/logger";

export interface HistoricalIntelligence {
  successPatterns: Array<{
    pattern: string;
    source: string;
    applicability: "direct" | "partial" | "reference";
  }>;
  knownFailures: Array<{
    failure: string;
    source: string;
    preventionSuggestion: string;
  }>;
  impliedRequirements: Array<{
    requirement: string;
    source: string;
    confidence: number;
  }>;
  technicalPatterns: Array<{
    pattern: string;
    context: string;
    relevance: "high" | "medium" | "low";
  }>;
  historicalQAIssues: Array<{
    issue: string;
    frequency: "always" | "often" | "sometimes";
  }>;
  reuseOpportunities: Array<{
    component: string;
    description: string;
    source: string;
  }>;
  historicalCoverage: "rich" | "moderate" | "sparse" | "none";
  intelligenceConfidence: number;
}

function emptyIntelligence(): HistoricalIntelligence {
  return {
    successPatterns: [],
    knownFailures: [],
    impliedRequirements: [],
    technicalPatterns: [],
    historicalQAIssues: [],
    reuseOpportunities: [],
    historicalCoverage: "none",
    intelligenceConfidence: 0,
  };
}

export async function extractHistoricalIntelligence(
  ticketAnalysis: TicketAnalysis,
  retrievedContext: RetrievedContext[],
  pipelineId: string
): Promise<{
  intelligence: HistoricalIntelligence;
  usage: import("../llm/discoveryCompletion").LlmUsage;
}> {
  if (retrievedContext.length === 0) {
    logger.info({ pipelineId }, "no historical context — empty intelligence");
    return { intelligence: emptyIntelligence(), usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 } };
  }

  const contextBlock = retrievedContext
    .map(
      (ctx, i) => `
[HISTORICAL ITEM ${i + 1}]
Source: ${ctx.jiraKey}
Type: ${ctx.contentType}
Similarity: ${(ctx.similarity * 100).toFixed(0)}%
Content:
${ctx.content}
      `.trim()
    )
    .join("\n\n---\n\n");

  const systemPrompt = `
You are a senior engineering lead with deep knowledge of your team's history.
Extract actionable intelligence from historical records for a new ticket.
Do not summarise — mine for patterns, failures, implied requirements, reuse.

Return ONLY valid JSON. No markdown. No preamble.
  `.trim();

  const userPrompt = `
New ticket:
Core Intent: ${ticketAnalysis.coreIntent}
Work Type: ${ticketAnalysis.workType}
Systems Affected: ${ticketAnalysis.systemsAffected.join(", ")}
Requirements Count: ${ticketAnalysis.atomicRequirements.length}

Historical context:
${contextBlock}

Return JSON:
{
  "successPatterns": [{ "pattern": "", "source": "", "applicability": "direct | partial | reference" }],
  "knownFailures": [{ "failure": "", "source": "", "preventionSuggestion": "" }],
  "impliedRequirements": [{ "requirement": "", "source": "", "confidence": 0.0 }],
  "technicalPatterns": [{ "pattern": "", "context": "", "relevance": "high | medium | low" }],
  "historicalQAIssues": [{ "issue": "", "frequency": "always | often | sometimes" }],
  "reuseOpportunities": [{ "component": "", "description": "", "source": "" }],
  "historicalCoverage": "rich | moderate | sparse | none",
  "intelligenceConfidence": 0.0
}

Rules:
- Only patterns with evidence in history
- Implied requirements must NOT repeat the current ticket
  `.trim();

  const { parsed, usage } = await completionJson<HistoricalIntelligence>({
    source: "historicalIntelligence",
    systemPrompt,
    userPrompt,
    maxTokens: 2500,
  });

  logger.info(
    {
      pipelineId,
      successPatterns: parsed.successPatterns.length,
      knownFailures: parsed.knownFailures.length,
      coverage: parsed.historicalCoverage,
    },
    "historical intelligence extracted"
  );

  return { intelligence: parsed, usage };
}
