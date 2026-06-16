import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validationTool } from "./validationTool";

describe("validationTool", () => {
  it("flags vague and non-testable criteria", async () => {
    const result = await validationTool.analyseCompleteness({
      userStories: [
        {
          id: "US-1",
          story: "As an admin I want to export audit logs so that I can share them with compliance reviewers.",
          acceptanceCriteria: [
            "The export should work well for large workspaces.",
            "Given an admin starts an export When the job completes Then a signed download link is shown.",
          ],
        },
      ],
      checkTypes: ["testability", "vague_language", "edge_cases", "nfr_coverage"],
    });

    assert.ok(result.totalIssues >= 2);
    assert.ok(
      result.issues.some((issue) => issue.checkType === "vague_language")
    );
    assert.ok(result.issues.some((issue) => issue.checkType === "edge_cases"));
  });

  it("scores PRD readiness and fails incomplete drafts", async () => {
    const result = await validationTool.scorePRDReadiness({
      prdDraft: {
        title: "Audit export",
        version: "v1.0",
        status: "Draft",
        jiraKey: "PLT-100",
        createdAt: new Date().toISOString(),
        priority: "high",
        effortEstimate: "6h agent pipeline",
        problemStatement: "Short statement",
        proposedSolution: "Short solution",
        successDefinition: "Done",
        userPersonas: [],
        userStories: [
          {
            id: "US-1",
            story: "As an admin I want to export audit logs.",
            acceptanceCriteria: ["Given admin When export Then file downloads"],
            priority: "must-have",
          },
        ],
        technicalRequirements: {
          endpoints: [],
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
        complexitySummary: {
          score: 5,
          effortOptimistic: "4h",
          effortRealistic: "6h",
          effortPessimistic: "10h",
          keyComplexityDrivers: [],
        },
        prdConfidence: 0.62,
        confidenceNotes: "Still missing detail.",
      },
      gapAnalysis: {
        knownKnowns: [],
        knownUnknowns: [],
        endpointGaps: [
          {
            description: "Need async export endpoint",
            existingEndpoint: null,
            newEndpointNeeded: "POST /exports",
            httpMethod: "POST",
            estimatedComplexity: "moderate",
          },
        ],
        dataGaps: [],
        accessGaps: [],
        nfrGaps: [
          {
            type: "security",
            gap: "RBAC not specified",
            defaultStandard: "workspace_admin only",
          },
        ],
        readinessForPRD: "needs-clarification",
        blockingGaps: 1,
        totalGaps: 2,
      },
    });

    assert.equal(result.passesGate, false);
    assert.ok(result.score < 0.7);
    assert.ok(result.failureReasons.length > 0);
  });
});
