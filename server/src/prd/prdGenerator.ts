import { ProductAgent } from "../agents/productAgent";
import type { ComplexityAssessment } from "../discovery/complexityScorer";
import type { GapAnalysis } from "../discovery/gapAnalyser";
import type { HistoricalIntelligence } from "../discovery/historicalIntelligence";
import type { TicketAnalysis } from "../discovery/ticketAnalyser";
import type { NormalizedTicket } from "../types/ticket";
import { logger } from "../utils/logger";

export interface GeneratedPRD {
  title: string;
  version: string;
  status: "Draft";
  jiraKey: string;
  createdAt: string;
  priority: string;
  effortEstimate: string;
  problemStatement: string;
  proposedSolution: string;
  successDefinition: string;
  userPersonas: Array<{
    persona: string;
    need: string;
    currentPain: string;
  }>;
  userStories: Array<{
    id: string;
    story: string;
    acceptanceCriteria: string[];
    priority: "must-have" | "should-have" | "nice-to-have";
  }>;
  technicalRequirements: {
    endpoints: Array<{
      method: string;
      path: string;
      description: string;
      requestBody: string | null;
      responseShape: string;
      authRequired: boolean;
      notes: string;
    }>;
    dataModel: Array<{
      table: string;
      changes: string;
      fields: string[];
    }>;
    systemsAffected: string[];
    technicalAssumptions: string[];
  };
  nonFunctionalRequirements: Array<{
    type: string;
    requirement: string;
    measurable: string;
  }>;
  assumptions: string[];
  outOfScope: string[];
  openQuestions: Array<{
    question: string;
    impact: string;
    defaultAssumption: string;
    owner: string;
  }>;
  risks: Array<{
    risk: string;
    probability: string;
    impact: string;
    mitigation: string;
  }>;
  successMetrics: Array<{
    metric: string;
    baseline: string;
    target: string;
    measurementMethod: string;
  }>;
  complexitySummary: {
    score: number;
    effortOptimistic: string;
    effortRealistic: string;
    effortPessimistic: string;
    keyComplexityDrivers: string[];
  };
  prdConfidence: number;
  confidenceNotes: string;
}

export async function generatePRD(
  ticket: NormalizedTicket,
  ticketAnalysis: TicketAnalysis,
  historicalIntelligence: HistoricalIntelligence,
  gapAnalysis: GapAnalysis,
  complexityAssessment: ComplexityAssessment,
  pipelineId: string
): Promise<{
  prd: GeneratedPRD;
  usage: import("../llm/discoveryCompletion").LlmUsage;
  toolCallLog: Array<{
    tool: string;
    query: string;
    resultsFound: number;
  }>;
}> {
  logger.info({ pipelineId, jiraKey: ticket.jiraKey }, "generating PRD");
  const productAgent = new ProductAgent();
  const { prd, usage, toolCallLog } = await productAgent.run({
    ticket,
    ticketAnalysis,
    historicalIntelligence,
    gapAnalysis,
    complexityAssessment,
    pipelineId,
  });

  logger.info(
    {
      pipelineId,
      jiraKey: ticket.jiraKey,
      userStories: prd.userStories?.length ?? 0,
      confidence: prd.prdConfidence,
      toolCalls: toolCallLog.length,
    },
    "PRD generated"
  );

  return { prd, usage, toolCallLog };
}
