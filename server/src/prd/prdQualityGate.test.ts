import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateGeneratedPrd } from "./prdQualityGate";
import type { GeneratedPRD } from "./prdGenerator";

function basePrd(overrides: Partial<GeneratedPRD> = {}): GeneratedPRD {
  return {
    title: "Curriculum update",
    version: "1.0",
    status: "Draft",
    jiraKey: "AG-61",
    createdAt: "2026-01-01T00:00:00.000Z",
    priority: "Medium",
    effortEstimate: "S · ~2h",
    problemStatement: "The curriculum for the first three months is outdated.",
    proposedSolution: "Publish an updated curriculum document in the repo.",
    successDefinition: "Stakeholders can review the new curriculum in docs.",
    userPersonas: [],
    userStories: [
      {
        id: "US-1",
        story: "As a lead I want an updated curriculum",
        acceptanceCriteria: ["Month 1 topics listed", "Month 2 topics listed"],
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
      score: 0.3,
      effortOptimistic: "1h",
      effortRealistic: "2h",
      effortPessimistic: "3h",
      keyComplexityDrivers: [],
    },
    implementationDeltaSummary: "No curriculum doc exists; net-new markdown file required.",
    implementationMode: "content",
    deliverableFiles: [
      { path: "docs/curriculum/q1-2026.md", format: "markdown", purpose: "Updated curriculum" },
    ],
    netNewWork: ["docs/curriculum/q1-2026.md"],
    prdConfidence: 0.8,
    confidenceNotes: "Clear doc deliverable",
    ...overrides,
  };
}

describe("validateGeneratedPrd content mode", () => {
  it("passes content PRD with deliverableFiles", () => {
    const result = validateGeneratedPrd(basePrd());
    assert.equal(result.passed, true);
  });

  it("fails content PRD without deliverableFiles", () => {
    const result = validateGeneratedPrd(
      basePrd({ deliverableFiles: [], implementationMode: "content" })
    );
    assert.equal(result.passed, false);
    assert.ok(result.issues.some((i) => i.includes("deliverableFiles")));
  });
});
