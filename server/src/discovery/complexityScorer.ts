import { completionJson } from "../llm/discoveryCompletion";
import type { GapAnalysis } from "./gapAnalyser";
import type { HistoricalIntelligence } from "./historicalIntelligence";
import type { TicketAnalysis } from "./ticketAnalyser";
import { logger } from "../utils/logger";
import {
  PROMPT_AGENT_PIPELINE_EFFORT_GUIDANCE,
  shouldBreakDownAgentPipeline,
} from "../shared/agentEffortCalibration";

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
    impactHours: number;
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
You are an AgentOS pipeline effort estimator. You size work for the automated agent pipeline
(Virin discovery → Ananta engineering → Neel QA), not human developer sprint timelines.
Add buffer for gaps and integration work. Return ONLY valid JSON.

${PROMPT_AGENT_PIPELINE_EFFORT_GUIDANCE}
  `.trim();

  const userPrompt = `
TICKET: ${ticketAnalysis.coreIntent} | ${ticketAnalysis.workType} | ${ticketAnalysis.roughComplexity}
GAPS: ${gapAnalysis.totalGaps} total, ${gapAnalysis.blockingGaps} blocking, readiness ${gapAnalysis.readinessForPRD}
ENDPOINTS: ${gapAnalysis.endpointGaps.map((e) => `- ${e.description} [${e.estimatedComplexity}]`).join("\n") || "None"}
DATA: ${gapAnalysis.dataGaps.map((d) => `- ${d.description}`).join("\n") || "None"}
HISTORY: ${historicalIntelligence.historicalCoverage}, failures ${historicalIntelligence.knownFailures.length}

Return JSON with overallScore (1-10), dimensions, effortEstimate (unit: "hours", realistic >= optimistic * 1.2),
complexityDrivers, estimateRisks (impactHours = extra agent pipeline hours if risk materializes),
shouldBreakDown (true if realistic > 8 hours agent pipeline time), priorityAssessment.
  `.trim();

  const { parsed, usage } = await completionJson<ComplexityAssessment>({
    source: "complexityScorer",
    systemPrompt,
    userPrompt,
    maxTokens: 2500,
  });

  const realisticHours = parsed.effortEstimate.realistic;
  const assessment: ComplexityAssessment = {
    ...parsed,
    effortEstimate: { ...parsed.effortEstimate, unit: parsed.effortEstimate.unit ?? "hours" },
    shouldBreakDown: shouldBreakDownAgentPipeline(realisticHours),
  };

  logger.info(
    {
      pipelineId,
      overallScore: assessment.overallScore,
      realisticHours,
      priority: assessment.priorityAssessment.recommendedPriority,
    },
    "complexity scored"
  );

  return { assessment, usage };
}
