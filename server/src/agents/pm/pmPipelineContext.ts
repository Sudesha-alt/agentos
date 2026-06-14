import type { GeneratedPRD } from "../../prd/prdGenerator";
import { generatedPrdToPrdOutput } from "../../prd/toPrdOutput";
import type { PrdOutput } from "../../types/agents";
import { buildTechAgentHandoffFromRecord } from "./handoff";
import type { PmAnalysisRecord } from "./types";

export interface PmPipelineContext {
  source: "pm_agents";
  jiraKey: string;
  generatedPrd: GeneratedPRD;
  prdOutput: PrdOutput;
  enrichedPrdDocument: Record<string, unknown>;
}

export function buildPmPipelineContext(record: PmAnalysisRecord): PmPipelineContext {
  if (!record.generatedPrd) {
    throw new Error(`PM PRD not generated for ${record.jiraKey}`);
  }

  const prdOutput = generatedPrdToPrdOutput(record.generatedPrd);

  return {
    source: "pm_agents",
    jiraKey: record.jiraKey,
    generatedPrd: record.generatedPrd,
    prdOutput,
    enrichedPrdDocument: {
      source: "pm_agents",
      prdOutput,
      generatedPrd: record.generatedPrd,
      pmEnrichment: record.enrichment,
      pmClassification: record.classification,
      pmCodebaseImpact: record.codebaseImpact,
      pmEffort: record.effortEstimate,
      pmImplementation: record.implementation,
      pmAcceptanceCriteria: record.acceptanceCriteria,
      pmPrioritization: record.prioritization,
      pmHandoff: buildTechAgentHandoffFromRecord(record),
      pmSystemDesign: record.systemDesign ?? null,
      pmTaskBreakdown: record.taskBreakdown ?? null,
      synthesisSummary: {
        historicalCoverage: 0,
        reusedPatterns: [],
        knownFailures: [],
        impliedRequirements: [],
        blockingGaps: 0,
      },
      scores: { prdQualityScore: record.generatedPrd.prdConfidence },
    },
  };
}
