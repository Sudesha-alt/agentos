import { completionJson } from "../llm/discoveryCompletion";
import type { GapAnalysis } from "./gapAnalyser";
import type { HistoricalIntelligence } from "./historicalIntelligence";
import type { TicketAnalysis } from "./ticketAnalyser";
import { logger } from "../utils/logger";

export interface ComplexityAssessment {
  overallScore: number;
  dimensions: {
    technicalComplexity: number;
    integrationComplexity: number;
    dataComplexity: number;
    uxComplexity: number;
    testingComplexity: number;
  };
  effortEstimate: {
    optimistic: number;
    realistic: number;
    pessimistic: number;
    unit: "hours" | "days" | "sprints";
  };
  complexityDrivers: Array<{
    driver: string;
    impact: "high" | "medium" | "low";
    mitigation: string;
  }>;
  estimateRisks: Array<{
    risk: string;
    probability: "high" | "medium" | "low";
    impactDays: number;
  }>;
  shouldBreakDown: boolean;
  breakdownSuggestion: string | null;
  priorityAssessment: {
    businessValue: number;
    technicalDebt: number;
    userImpact: number;
    recommendedPriority: "critical" | "high" | "medium" | "low";
    priorityReasoning: string;
  };
}

export async function scoreComplexity(
  ticketAnalysis: TicketAnalysis,
  historicalIntelligence: HistoricalIntelligence,
  gapAnalysis: GapAnalysis,
  pipelineId: string
): Promise<{
  assessment: ComplexityAssessment;
  usage: import("../llm/discoveryCompletion").LlmUsage;
}> {
  logger.info({ pipelineId }, "scoring complexity");

  const systemPrompt = `
You are a principal engineer with calibrated, honest complexity estimates.
Add buffer for gaps and integration work. Return ONLY valid JSON.
  `.trim();

  const userPrompt = `
TICKET: ${ticketAnalysis.coreIntent} | ${ticketAnalysis.workType} | ${ticketAnalysis.roughComplexity}
GAPS: ${gapAnalysis.totalGaps} total, ${gapAnalysis.blockingGaps} blocking, readiness ${gapAnalysis.readinessForPRD}
ENDPOINTS: ${gapAnalysis.endpointGaps.map((e) => `- ${e.description} [${e.estimatedComplexity}]`).join("\n") || "None"}
DATA: ${gapAnalysis.dataGaps.map((d) => `- ${d.description}`).join("\n") || "None"}
HISTORY: ${historicalIntelligence.historicalCoverage}, failures ${historicalIntelligence.knownFailures.length}

Return JSON with overallScore (1-10), dimensions, effortEstimate (realistic >= optimistic * 1.2),
complexityDrivers, estimateRisks, shouldBreakDown (true if realistic > 10 days), priorityAssessment.
  `.trim();

  const { parsed, usage } = await completionJson<ComplexityAssessment>({
    source: "complexityScorer",
    systemPrompt,
    userPrompt,
    maxTokens: 2500,
  });

  logger.info(
    {
      pipelineId,
      overallScore: parsed.overallScore,
      realisticDays: parsed.effortEstimate.realistic,
      priority: parsed.priorityAssessment.recommendedPriority,
    },
    "complexity scored"
  );

  return { assessment: parsed, usage };
}
