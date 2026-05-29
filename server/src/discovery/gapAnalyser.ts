import { completionJson } from "../llm/discoveryCompletion";
import type { HistoricalIntelligence } from "./historicalIntelligence";
import type { TicketAnalysis } from "./ticketAnalyser";
import { logger } from "../utils/logger";

export type GapCategory =
  | "business-logic"
  | "technical-design"
  | "user-experience"
  | "data-model"
  | "api-contract"
  | "auth-permissions"
  | "error-handling"
  | "performance"
  | "scope-boundary";

export interface GapAnalysis {
  knownKnowns: Array<{
    item: string;
    confidence: number;
    source: "ticket" | "history" | "implied";
  }>;
  knownUnknowns: Array<{
    gap: string;
    category: GapCategory;
    resolutionRequired: boolean;
    suggestedResolution: string;
    defaultAssumption: string;
  }>;
  endpointGaps: Array<{
    description: string;
    existingEndpoint: string | null;
    newEndpointNeeded: string | null;
    httpMethod: string | null;
    estimatedComplexity: "simple" | "moderate" | "complex";
  }>;
  dataGaps: Array<{
    description: string;
    newFieldsNeeded: string[];
    newTablesNeeded: string[];
    existingTablesAffected: string[];
  }>;
  accessGaps: Array<{
    description: string;
    rolesInvolved: string[];
    permissionModel: string;
  }>;
  nfrGaps: Array<{
    type:
      | "performance"
      | "security"
      | "scalability"
      | "accessibility"
      | "i18n"
      | "logging"
      | "monitoring";
    gap: string;
    defaultStandard: string;
  }>;
  readinessForPRD: "ready" | "ready-with-assumptions" | "needs-clarification";
  blockingGaps: number;
  totalGaps: number;
}

export async function analyseGaps(
  ticketAnalysis: TicketAnalysis,
  historicalIntelligence: HistoricalIntelligence,
  pipelineId: string
): Promise<{ analysis: GapAnalysis; usage: import("../llm/discoveryCompletion").LlmUsage }> {
  logger.info({ pipelineId }, "starting gap analysis");

  const systemPrompt = `
You are a staff engineer and product architect who finds everything missing
in a feature specification before development starts. Be exhaustive and specific.

Return ONLY valid JSON. No markdown. No preamble.
  `.trim();

  const userPrompt = `
TICKET ANALYSIS:
Core Intent: ${ticketAnalysis.coreIntent}
Work Type: ${ticketAnalysis.workType}
Rough Complexity: ${ticketAnalysis.roughComplexity}
Systems: ${ticketAnalysis.systemsAffected.join(", ")}

AMBIGUITIES:
${ticketAnalysis.ambiguities.map((a) => `- [${a.impact}] ${a.description} → ${a.question}`).join("\n")}

REQUIREMENTS:
${ticketAnalysis.atomicRequirements.map((r) => `- [${r.type}/${r.source}/${r.clarity}] ${r.description}`).join("\n")}

HISTORICAL:
Implied: ${historicalIntelligence.impliedRequirements.map((r) => `- ${r.requirement}`).join("\n") || "None"}
Failures: ${historicalIntelligence.knownFailures.map((f) => `- ${f.failure}`).join("\n") || "None"}
QA: ${historicalIntelligence.historicalQAIssues.map((i) => `- [${i.frequency}] ${i.issue}`).join("\n") || "None"}

Return JSON with knownKnowns, knownUnknowns, endpointGaps, dataGaps, accessGaps, nfrGaps,
readinessForPRD, blockingGaps, totalGaps.

Rules:
- endpointGaps: specific HTTP methods and paths
- Every knownUnknown needs defaultAssumption
- nfrGaps: performance, security, logging, monitoring
- blockingGaps = count where resolutionRequired is true
  `.trim();

  const { parsed, usage } = await completionJson<GapAnalysis>({
    source: "gapAnalyser",
    systemPrompt,
    userPrompt,
    maxTokens: 4000,
  });

  const blockingGaps =
    parsed.blockingGaps ??
    parsed.knownUnknowns.filter((u) => u.resolutionRequired).length;
  const totalGaps =
    parsed.totalGaps ??
    parsed.knownUnknowns.length +
      parsed.endpointGaps.length +
      parsed.dataGaps.length +
      parsed.accessGaps.length +
      parsed.nfrGaps.length;

  const analysis: GapAnalysis = { ...parsed, blockingGaps, totalGaps };

  logger.info(
    {
      pipelineId,
      totalGaps: analysis.totalGaps,
      blockingGaps: analysis.blockingGaps,
      readiness: analysis.readinessForPRD,
    },
    "gap analysis complete"
  );

  return { analysis, usage };
}
