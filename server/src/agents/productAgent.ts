import { runAgenticLoop } from "../agenticLoop/loop";
import type { ComplexityAssessment } from "../discovery/complexityScorer";
import type { GapAnalysis } from "../discovery/gapAnalyser";
import type { HistoricalIntelligence } from "../discovery/historicalIntelligence";
import { parseDiscoveryJson, type LlmUsage } from "../llm/discoveryCompletion";
import type { GeneratedPRD } from "../prd/prdGenerator";
import type { NormalizedTicket } from "../types/ticket";
import type { TicketAnalysis } from "../discovery/ticketAnalyser";
import { logger } from "../utils/logger";

export interface ProductAgentInput {
  ticket: NormalizedTicket;
  ticketAnalysis: TicketAnalysis;
  historicalIntelligence: HistoricalIntelligence;
  gapAnalysis: GapAnalysis;
  complexityAssessment: ComplexityAssessment;
  pipelineId: string;
}

export interface ProductAgentResult {
  prd: GeneratedPRD;
  raw: string;
  usage: LlmUsage;
  toolCallLog: Array<{
    tool: string;
    query: string;
    resultsFound: number;
  }>;
}

export class ProductAgent {
  readonly name = "PRODUCT_AGENT";

  async run(input: ProductAgentInput): Promise<ProductAgentResult> {
    const loop = await runAgenticLoop({
      systemPrompt: buildSystemPrompt(),
      initialUserMessage: buildInitialUserMessage(input),
      pipelineId: input.pipelineId,
      jiraKey: input.ticket.jiraKey,
    });

    const prd = parseDiscoveryJson<GeneratedPRD>(loop.finalResponse, "productAgent");

    logger.info(
      {
        pipelineId: input.pipelineId,
        jiraKey: input.ticket.jiraKey,
        toolCalls: loop.toolCallCount,
        userStories: prd.userStories?.length ?? 0,
      },
      "product agent completed"
    );

    return {
      prd,
      raw: loop.finalResponse,
      usage: {
        inputTokens: loop.totalInputTokens,
        outputTokens: loop.totalOutputTokens,
        costUsd: loop.totalCostUsd,
      },
      toolCallLog: loop.toolCallLog,
    };
  }
}

function buildSystemPrompt(): string {
  return `
You are a principal product manager writing the final PRD for a Jira ticket.

You are operating in an agentic tool loop. You may call tools to search
historical context, inspect related Jira tickets, analyse requirement
completeness, and score PRD readiness before you finalise the document.

Use tools thoughtfully:
- Use search_historical_context when you need past scoping, implementation,
  or QA examples. Query in natural language and search multiple times if you
  need different angles.
- Use fetch_related_jira_tickets when epic, linked, component, or sprint
  context would change scope or dependencies.
- Use analyse_requirement_completeness before finalising user stories.
- Use score_prd_readiness before your final answer and fix any clear issues if
  the score is below 0.70.

Important working rules:
- Do not invent requirements not grounded in the ticket, discovery inputs, or
  tool results.
- Every acceptance criterion must be testable and written in Given/When/Then form.
- Every non-functional requirement must be measurable.
- Keep scope realistic and explicit.
- If ambiguity remains, capture it in openQuestions with a default assumption and owner.
- Return ONLY valid JSON in your final answer. No markdown, no prose, no code fences.

Final JSON schema:
{
  "title": "string",
  "version": "v1.0",
  "status": "Draft",
  "jiraKey": "string",
  "createdAt": "ISO timestamp",
  "priority": "string",
  "effortEstimate": "string",
  "problemStatement": "string",
  "proposedSolution": "string",
  "successDefinition": "string",
  "userPersonas": [
    { "persona": "string", "need": "string", "currentPain": "string" }
  ],
  "userStories": [
    {
      "id": "US-001",
      "story": "As a ...",
      "acceptanceCriteria": [
        "Given ... When ... Then ..."
      ],
      "priority": "must-have | should-have | nice-to-have"
    }
  ],
  "technicalRequirements": {
    "endpoints": [
      {
        "method": "GET | POST | PUT | PATCH | DELETE",
        "path": "/api/...",
        "description": "string",
        "requestBody": "string or null",
        "responseShape": "string",
        "authRequired": true,
        "notes": "string"
      }
    ],
    "dataModel": [
      {
        "table": "string",
        "changes": "string",
        "fields": ["string"]
      }
    ],
    "systemsAffected": ["string"],
    "technicalAssumptions": ["string"]
  },
  "nonFunctionalRequirements": [
    {
      "type": "string",
      "requirement": "string",
      "measurable": "string"
    }
  ],
  "assumptions": ["string"],
  "outOfScope": ["string"],
  "openQuestions": [
    {
      "question": "string",
      "impact": "string",
      "defaultAssumption": "string",
      "owner": "string"
    }
  ],
  "risks": [
    {
      "risk": "string",
      "probability": "low | medium | high",
      "impact": "string",
      "mitigation": "string"
    }
  ],
  "successMetrics": [
    {
      "metric": "string",
      "baseline": "string",
      "target": "string",
      "measurementMethod": "string"
    }
  ],
  "complexitySummary": {
    "score": 0,
    "effortOptimistic": "string",
    "effortRealistic": "string",
    "effortPessimistic": "string",
    "keyComplexityDrivers": ["string"]
  },
  "prdConfidence": 0.0,
  "confidenceNotes": "string"
}
  `.trim();
}

function buildInitialUserMessage(input: ProductAgentInput): string {
  return `
Write the final PRD for the following Jira ticket.

Current ticket:
${safeJson({
    jiraKey: input.ticket.jiraKey,
    jiraTicketId: input.ticket.jiraTicketId,
    summary: input.ticket.summary,
    description: input.ticket.description,
    issueType: input.ticket.issueType,
    priority: input.ticket.priority,
    reporter: input.ticket.reporter,
    assignee: input.ticket.assignee,
    labels: input.ticket.labels,
    components: input.ticket.components,
    epicLink: input.ticket.epicLink,
    storyPoints: input.ticket.storyPoints,
    projectKey: input.ticket.projectKey,
  })}

Discovery ticket analysis:
${safeJson(input.ticketAnalysis)}

High-level historical discovery summary:
${safeJson({
    historicalCoverage: input.historicalIntelligence.historicalCoverage,
    successPatterns: input.historicalIntelligence.successPatterns,
    knownFailures: input.historicalIntelligence.knownFailures,
    impliedRequirements: input.historicalIntelligence.impliedRequirements,
    reuseOpportunities: input.historicalIntelligence.reuseOpportunities,
  })}

Gap analysis:
${safeJson(input.gapAnalysis)}

Complexity assessment:
${safeJson(input.complexityAssessment)}

Instructions:
1. Use search_historical_context if you need concrete past examples, precedents,
   or testing/implementation patterns.
2. Use fetch_related_jira_tickets if epic or dependency context would help scope.
3. Draft the PRD in the final JSON schema.
4. Before finalising, run analyse_requirement_completeness on your drafted
   userStories and acceptanceCriteria.
5. Before finalising, run score_prd_readiness using your full PRD draft and the
   exact gap analysis object above.
6. If the readiness score is below 0.70, improve the draft and re-check if useful.
7. Return ONLY the final PRD JSON.
  `.trim();
}

function safeJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
