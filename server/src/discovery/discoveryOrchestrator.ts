import { auditRepo } from "../db/repositories/auditRepo";
import { mergeUsage, type LlmUsage } from "../llm/discoveryCompletion";
import { attachPRDToJira } from "../prd/prdAttacher";
import { generatePRD, type GeneratedPRD } from "../prd/prdGenerator";
import { generatedPrdToPrdOutput } from "../prd/toPrdOutput";
import { embedder } from "../rag/embedder";
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
  await auditRepo.log(pipelineId, "PRODUCT_AGENT_STARTED", { jiraKey: ticket.jiraKey });

  // Ingestion already embedded the ticket — skip duplicate embed work here.
  await auditRepo.log(pipelineId, "DISCOVERY_STEP_STARTED", {
    step: "context_retrieval",
    label: "Retrieving similar tickets and codebase context",
  });

  const scope = await import("../codebaseIntelligence/repoScope").then((m) =>
    m.resolveRepoScope()
  );
  const unifiedQuery = `${ticket.summary} ${ticket.description}`;
  const unified = await unifiedRetriever.retrieveUnified(unifiedQuery, {
    ticketTypes: ["ticket", "prd", "implementation", "qa_report", "canary_finding"],
    codebase: { branchName: scope?.defaultBranch ?? "main", topK: 8 },
    includeCodebase: Boolean(scope),
    topKTotal: 12,
    currentJiraKey: ticket.jiraKey,
    queryComponents: ticket.components,
    similarityThreshold: 0.7,
  });

  const historicalContext = unified.retrievedContext;
  await auditRepo.log(pipelineId, "CONTEXT_RETRIEVED", {
    chunksFound: historicalContext.length,
    codebaseHits: unified.items.filter((i) => i.kind === "codebase").length,
    topSimilarity: historicalContext[0]?.similarity ?? 0,
  });

  await auditRepo.log(pipelineId, "DISCOVERY_STEP_STARTED", {
    step: "ticket_analysis",
    label: "Analyzing ticket requirements",
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

  await auditRepo.log(pipelineId, "DISCOVERY_STEP_STARTED", {
    step: "historical_intelligence",
    label: "Extracting historical patterns and precedents",
  });
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

  await auditRepo.log(pipelineId, "DISCOVERY_STEP_STARTED", {
    step: "gap_analysis",
    label: "Identifying requirement gaps",
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

  await auditRepo.log(pipelineId, "DISCOVERY_STEP_STARTED", {
    step: "complexity_scoring",
    label: "Scoring implementation complexity",
  });
  const { assessment: complexityAssessment, usage: u4 } = await scoreComplexity(
    ticketAnalysis,
    historicalIntelligence,
    gapAnalysis,
    pipelineId
  );
  usages.push(u4);
  await auditRepo.log(pipelineId, "COMPLEXITY_SCORED", {
    score: complexityAssessment.overallScore,
    realisticHours: complexityAssessment.effortEstimate.realistic,
    priority: complexityAssessment.priorityAssessment.recommendedPriority,
  });

  await auditRepo.log(pipelineId, "DISCOVERY_STEP_STARTED", {
    step: "prd_generation",
    label: "Virin is drafting the PRD",
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
    retrievedContext: historicalContext,
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

  try {
    await attachPRDToJira(ticket.jiraKey, prd);
  } catch (err) {
    logger.warn({ err, jiraKey: ticket.jiraKey }, "PRD Jira attach failed — continuing pipeline");
  }

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
