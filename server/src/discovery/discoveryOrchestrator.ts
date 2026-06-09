import { auditRepo } from "../db/repositories/auditRepo";
import { mergeUsage, type LlmUsage } from "../llm/discoveryCompletion";
import { attachPRDToJira } from "../prd/prdAttacher";
import { generatePRD, type GeneratedPRD } from "../prd/prdGenerator";
import { generatedPrdToPrdOutput } from "../prd/toPrdOutput";
import { embedder } from "../rag/embedder";
import { retriever } from "../rag/retriever";
import { unifiedRetriever } from "../rag/unifiedRetriever";
import type { PrdOutput } from "../types/agents";
import type { NormalizedTicket } from "../types/ticket";
import { logger } from "../utils/logger";
import { stateManager } from "../pipeline/stateManager";
import { scoreComplexity, type ComplexityAssessment } from "./complexityScorer";
import { analyseGaps, type GapAnalysis } from "./gapAnalyser";
import {
  extractHistoricalIntelligence,
  type HistoricalIntelligence,
} from "./historicalIntelligence";
import { analyseTicket, type TicketAnalysis } from "./ticketAnalyser";
import {
  applyComputedScores,
  runProductValidation,
  type ComputedDiscoveryScores,
} from "./scoring";

const BLOCKING_GAP_THRESHOLD = Number(
  process.env.DISCOVERY_BLOCKING_GAP_THRESHOLD ?? "5"
);

export interface DiscoveryResult {
  ticketAnalysis: TicketAnalysis;
  historicalIntelligence: HistoricalIntelligence;
  gapAnalysis: GapAnalysis;
  complexityAssessment: ComplexityAssessment;
  prd: GeneratedPRD;
  prdOutput: PrdOutput;
  scores: ComputedDiscoveryScores;
  toolCallLog: Array<{
    tool: string;
    query: string;
    resultsFound: number;
  }>;
  totalTokensUsed: number;
  totalCostUsd: number;
  durationMs: number;
}

export class DiscoveryPausedError extends Error {
  constructor(
    message: string,
    public readonly blockingGaps: number
  ) {
    super(message);
    this.name = "DiscoveryPausedError";
  }
}

export async function runDiscovery(
  ticket: NormalizedTicket,
  pipelineId: string
): Promise<DiscoveryResult> {
  const startTime = Date.now();
  const usages: LlmUsage[] = [];

  logger.info({ jiraKey: ticket.jiraKey, pipelineId }, "discovery started");

  await embedder.embedTicket(
    ticket.jiraTicketId,
    ticket.jiraKey,
    ticket
  );
  await auditRepo.log(pipelineId, "TICKET_EMBEDDED", { jiraKey: ticket.jiraKey });

  const retrievedContext = await retriever.retrieveForProductAgent(
    ticket,
    ticket.jiraKey
  );
  await auditRepo.log(pipelineId, "CONTEXT_RETRIEVED", {
    chunksFound: retrievedContext.length,
    topSimilarity: retrievedContext[0]?.similarity ?? 0,
  });

  const { analysis: ticketAnalysis, usage: u1 } = await analyseTicket(
    ticket,
    pipelineId
  );
  usages.push(u1);
  await auditRepo.log(pipelineId, "TICKET_ANALYSED", {
    requirementsFound: ticketAnalysis.atomicRequirements.length,
    ambiguities: ticketAnalysis.ambiguities.length,
  });

  const scope = await import("../codebaseIntelligence/repoScope").then((m) =>
    m.resolveRepoScope()
  );
  const unifiedQuery = `${ticket.summary} ${ticket.description} ${ticketAnalysis.coreIntent}`;
  const unified = await unifiedRetriever.retrieveUnified(unifiedQuery, {
    ticketTypes: ["ticket", "prd", "implementation", "qa_report"],
    codebase: { branchName: scope?.defaultBranch ?? "main", topK: 8 },
    topKTotal: 12,
    currentJiraKey: ticket.jiraKey,
    queryComponents: ticket.components,
    similarityThreshold: 0.7,
  });

  const historicalContext =
    unified.retrievedContext.length > 0
      ? unified.retrievedContext
      : retrievedContext;

  const { intelligence: historicalIntelligence, usage: u2 } =
    await extractHistoricalIntelligence(
      ticketAnalysis,
      historicalContext,
      pipelineId,
      unified.fusedBlock
    );
  usages.push(u2);
  await auditRepo.log(pipelineId, "INTELLIGENCE_EXTRACTED", {
    patterns: historicalIntelligence.successPatterns.length,
    failures: historicalIntelligence.knownFailures.length,
    implied: historicalIntelligence.impliedRequirements.length,
  });

  const { analysis: gapAnalysis, usage: u3 } = await analyseGaps(
    ticketAnalysis,
    historicalIntelligence,
    pipelineId
  );
  usages.push(u3);
  await auditRepo.log(pipelineId, "GAPS_ANALYSED", {
    totalGaps: gapAnalysis.totalGaps,
    blockingGaps: gapAnalysis.blockingGaps,
    readiness: gapAnalysis.readinessForPRD,
  });

  if (gapAnalysis.blockingGaps > BLOCKING_GAP_THRESHOLD) {
    await stateManager.pauseForHuman(
      pipelineId,
      "PRODUCT_AGENT",
      `Too many blocking gaps (${gapAnalysis.blockingGaps}). Human clarification required.`
    );
    throw new DiscoveryPausedError(
      `Too many blocking gaps (${gapAnalysis.blockingGaps}). Human clarification required.`,
      gapAnalysis.blockingGaps
    );
  }

  const { assessment: complexityAssessment, usage: u4 } = await scoreComplexity(
    ticketAnalysis,
    historicalIntelligence,
    gapAnalysis,
    pipelineId
  );
  usages.push(u4);
  await auditRepo.log(pipelineId, "COMPLEXITY_SCORED", {
    score: complexityAssessment.overallScore,
    realisticDays: complexityAssessment.effortEstimate.realistic,
    priority: complexityAssessment.priorityAssessment.recommendedPriority,
  });

  const { prd, usage: u5, toolCallLog } = await generatePRD(
    ticket,
    ticketAnalysis,
    historicalIntelligence,
    gapAnalysis,
    complexityAssessment,
    pipelineId
  );
  usages.push(u5);

  const scores = runProductValidation({
    ticketAnalysis,
    historicalIntelligence,
    gapAnalysis,
    complexityAssessment,
    prd,
    retrievedContext,
  });
  applyComputedScores(scores, {
    ticketAnalysis,
    historicalIntelligence,
    gapAnalysis,
    complexityAssessment,
    prd,
  });

  await auditRepo.log(pipelineId, "PRD_GENERATED", {
    userStories: prd.userStories?.length ?? 0,
    endpoints: prd.technicalRequirements?.endpoints?.length ?? 0,
    toolCalls: toolCallLog.length,
  });
  await auditRepo.log(pipelineId, "SCORES_COMPUTED", {
    understandingScore: scores.understandingScore,
    prdQualityScore: scores.prdQualityScore,
    prdQualityBand: `${scores.bands.prdQuality.low}-${scores.bands.prdQuality.high}`,
    historicalSignalScore: scores.historicalSignalScore,
    complexityScore: scores.complexityScore,
    passesGate: scores.passesGate,
    recommendation: scores.recommendation,
    gateFailureReasons: scores.gateFailureReasons,
  });

  await attachPRDToJira(ticket.jiraKey, prd);

  const prdOutput = generatedPrdToPrdOutput(prd, scores);
  await embedder.embedPRD(ticket.jiraTicketId, ticket.jiraKey, prdOutput);

  const merged = mergeUsage(usages);
  const durationMs = Date.now() - startTime;

  await auditRepo.log(pipelineId, "DISCOVERY_COMPLETE", {
    jiraKey: ticket.jiraKey,
    durationMs,
    totalTokens: merged.inputTokens + merged.outputTokens,
    totalCost: merged.costUsd,
  });

  logger.info(
    {
      jiraKey: ticket.jiraKey,
      pipelineId,
      durationMs,
      prdQualityScore: scores.prdQualityScore,
      understandingScore: scores.understandingScore,
    },
    "discovery complete"
  );

  return {
    ticketAnalysis,
    historicalIntelligence,
    gapAnalysis,
    complexityAssessment,
    prd,
    prdOutput,
    scores,
    toolCallLog,
    totalTokensUsed: merged.inputTokens + merged.outputTokens,
    totalCostUsd: merged.costUsd,
    durationMs,
  };
}
