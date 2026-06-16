import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateUnderstandingScore,
  runProductValidation,
} from "./scoring";
import type { TicketAnalysis } from "./ticketAnalyser";

const baseAnalysis: TicketAnalysis = {
  coreIntent: "Enable workspace audit export for compliance",
  atomicRequirements: [
    {
      id: "REQ-001",
      description: "Export data",
      type: "functional",
      source: "explicit",
      clarity: "clear",
    },
  ],
  ambiguities: [],
  userPersonas: [{ persona: "Admin", need: "export", currentPain: "manual" }],
  systemsAffected: ["API"],
  roughComplexity: "medium",
  workType: "new-feature",
  understandingConfidence: 0.99,
};

describe("discovery scoring", () => {
  it("separates very bad tickets via extra blocking-ambiguity penalty", () => {
    const mild = calculateUnderstandingScore({
      ...baseAnalysis,
      ambiguities: [
        { description: "a", impact: "blocking", question: "q1" },
        { description: "b", impact: "blocking", question: "q2" },
      ],
    });
    const severe = calculateUnderstandingScore({
      ...baseAnalysis,
      atomicRequirements: [],
      coreIntent: "",
      userPersonas: [],
      ambiguities: [
        { description: "a", impact: "blocking", question: "q1" },
        { description: "b", impact: "blocking", question: "q2" },
        { description: "c", impact: "blocking", question: "q3" },
        { description: "d", impact: "blocking", question: "q4" },
      ],
    });
    assert.ok(severe < mild);
    assert.ok(mild > 0);
  });

  it("runProductValidation returns gate and bands", () => {
    const result = runProductValidation({
      ticketAnalysis: baseAnalysis,
      historicalIntelligence: {
        successPatterns: [{ pattern: "async export", source: "X", applicability: "direct" }],
        knownFailures: [],
        impliedRequirements: [],
        technicalPatterns: [],
        historicalQAIssues: [],
        reuseOpportunities: [{ component: "s3", description: "reuse", source: "X" }],
        historicalCoverage: "moderate",
        intelligenceConfidence: 0.6,
      },
      gapAnalysis: {
        knownKnowns: [],
        knownUnknowns: [],
        endpointGaps: [
          {
            description: "POST export",
            existingEndpoint: null,
            newEndpointNeeded: "POST /exports",
            httpMethod: "POST",
            estimatedComplexity: "moderate",
          },
        ],
        dataGaps: [],
        accessGaps: [],
        nfrGaps: [
          { type: "performance", gap: "no SLA", defaultStandard: "p95 < 8m" },
          { type: "security", gap: "no auth spec", defaultStandard: "RBAC" },
        ],
        readinessForPRD: "ready-with-assumptions",
        blockingGaps: 0,
        totalGaps: 3,
      },
      prd: {
        title: "Export",
        version: "v1",
        status: "Draft",
        jiraKey: "T-1",
        createdAt: new Date().toISOString(),
        priority: "High",
        effortEstimate: "6h",
        problemStatement: "A".repeat(90),
        proposedSolution: "B".repeat(90),
        successDefinition: "Done",
        userPersonas: [],
        userStories: [
          {
            id: "US-1",
            story: "As admin I want export",
            acceptanceCriteria: ["Given a When b Then c", "Given d When e Then f"],
            priority: "must-have",
          },
        ],
        technicalRequirements: {
          endpoints: [{ method: "POST", path: "/exports", description: "x", requestBody: null, responseShape: "{}", authRequired: true, notes: "" }],
          dataModel: [],
          systemsAffected: [],
          technicalAssumptions: [],
        },
        nonFunctionalRequirements: [],
        assumptions: [],
        outOfScope: [],
        openQuestions: [],
        risks: [],
        successMetrics: [],
        complexitySummary: { score: 6, effortOptimistic: "4h", effortRealistic: "6h", effortPessimistic: "10h", keyComplexityDrivers: [] },
        prdConfidence: 0.99,
        confidenceNotes: "",
      },
      retrievedContext: [
        { jiraTicketId: "1", jiraKey: "A-1", contentType: "ticket", content: "x", similarity: 0.82, metadata: {} },
        { jiraTicketId: "2", jiraKey: "A-2", contentType: "prd", content: "y", similarity: 0.78, metadata: {} },
      ],
      complexityAssessment: {
        overallScore: 9,
        dimensions: { technicalComplexity: 6, integrationComplexity: 6, dataComplexity: 5, uxComplexity: 4, testingComplexity: 6 },
        effortEstimate: { optimistic: 4, realistic: 6, pessimistic: 10, unit: "hours" },
        complexityDrivers: [],
        estimateRisks: [],
        shouldBreakDown: false,
        breakdownSuggestion: null,
        priorityAssessment: { businessValue: 7, technicalDebt: 5, userImpact: 6, recommendedPriority: "high", priorityReasoning: "" },
      },
    });

    assert.ok(result.bands.prdQuality.low <= result.prdQualityScore);
    assert.ok(result.bands.prdQuality.high >= result.prdQualityScore);
    assert.ok(["proceed", "review", "clarify"].includes(result.recommendation));
  });
});
