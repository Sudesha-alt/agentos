import { describe, expect, it } from "vitest";
import { validatePrd } from "./prdValidator";

const validPrd = {
  title: "User onboarding flow",
  problemStatement: "New users abandon signup before completing profile setup.",
  proposedSolution: "Add a guided three-step wizard with save-and-resume.",
  userStories: ["As a new user I want a wizard so I can finish onboarding quickly"],
  acceptanceCriteria: [
    "Given a new account When the user opens the app Then the wizard starts on step one",
    "Given step two When the user saves progress Then they can resume within seven days",
  ],
  outOfScope: ["Social login"],
  edgeCases: ["User closes browser mid-flow"],
  dependencies: ["Auth service"],
  successMetrics: ["Completion rate above 80%"],
  openQuestions: [],
  confidenceScore: 0.5,
  confidenceReason: "Based on Virin PRD synthesis with stakeholder review.",
};

describe("validatePrd", () => {
  it("fails low confidence for discovery PRDs", () => {
    const result = validatePrd(validPrd);
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.code === "LOW_CONFIDENCE")).toBe(true);
  });

  it("allows low confidence for Virin handoff PRDs", () => {
    const result = validatePrd(validPrd, { source: "pm_agents" });
    expect(result.passed).toBe(true);
    expect(result.issues.some((i) => i.code === "LOW_CONFIDENCE")).toBe(false);
  });
});
