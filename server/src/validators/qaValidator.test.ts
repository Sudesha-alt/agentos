import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PrdOutput, QaOutput } from "../types/agents";
import { normalizeCriterion, validateQa } from "./qaValidator";

const prdCriteria = [
  "There is a single public-ready document that lists Weeks 1–52 with titles and 2–3 bullets each.",
  "The first ~13 weeks clearly focus on IT/computing foundations and later weeks clearly focus on security topics.",
  "A new file docs/curriculum/year-1-52-week-curriculum.md exists in the repo.",
];

const prd: PrdOutput = {
  title: "Year-1 curriculum",
  problemStatement: "Need canonical curriculum",
  proposedSolution: "Write markdown doc",
  userStories: [],
  acceptanceCriteria: prdCriteria,
  outOfScope: [],
  edgeCases: [],
  dependencies: [],
  successMetrics: [],
  openQuestions: [],
  confidenceScore: 0.9,
  confidenceReason: "test",
};

function buildQa(linkedCriteria: string[]): QaOutput {
  return {
    testSummary: "Reviewed curriculum docs on agentos/ag-62 against acceptance criteria.",
    testCases: linkedCriteria.map((linkedCriterion, i) => ({
      id: `TC-${String(i + 1).padStart(3, "0")}`,
      title: `Verify criterion ${i + 1}`,
      type: "integration" as const,
      linkedCriterion,
      preconditions: ["Branch agentos/ag-62 checked out"],
      steps: ["read_implementation_files"],
      expectedResult: linkedCriterion,
      priority: "high" as const,
    })),
    coverageReport: {
      totalCriteria: prdCriteria.length,
      coveredCriteria: prdCriteria.length,
      coveragePercent: 100,
      uncoveredCriteria: [],
    },
    riskAreas: [],
    automationRecommendations: [],
    confidenceScore: 0.9,
    confidenceReason: "All criteria reviewed via checklist cases.",
  };
}

describe("normalizeCriterion", () => {
  it("strips numbered list prefixes from Neel output", () => {
    assert.equal(
      normalizeCriterion(
        "1. There is a single public-ready document that lists Weeks 1–52 with titles and 2–3 bullets each."
      ),
      normalizeCriterion(
        "There is a single public-ready document that lists Weeks 1–52 with titles and 2–3 bullets each."
      )
    );
  });
});

describe("validateQa", () => {
  it("passes when linkedCriterion uses numbered prefixes from the prompt", () => {
    const numbered = prdCriteria.map((c, i) => `${i + 1}. ${c}`);
    const result = validateQa(buildQa(numbered), prd);
    assert.equal(result.passed, true, result.issues.map((i) => i.message).join("; "));
  });

  it("passes when linkedCriterion matches PRD text exactly", () => {
    const result = validateQa(buildQa(prdCriteria), prd);
    assert.equal(result.passed, true);
  });

  it("fails when criteria are genuinely uncovered", () => {
    const result = validateQa(buildQa([prdCriteria[0]!]), prd);
    assert.equal(result.passed, false);
    assert.ok(result.issues.some((i) => i.code === "COVERAGE_BELOW_THRESHOLD"));
  });
});
