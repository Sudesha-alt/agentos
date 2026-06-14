import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeEstimatedRoi } from "./estimatedRoi";

describe("computeEstimatedRoi", () => {
  it("returns positive savings for growth tier defaults", () => {
    const result = computeEstimatedRoi({
      planId: "growth",
      teamSize: 10,
      hourlyRate: 150,
      pipelineRunsPerMonth: 80,
      sprintWeeks: 2,
      reworkRate: 0.25,
    });

    assert.equal(result.mode, "estimated");
    assert.ok(result.hoursSavedPerRun > 0);
    assert.ok(result.annualLaborSavings > result.annualSubscription);
    assert.ok(result.netAnnualBenefit > 0);
    assert.ok(result.roiMultiple > 1);
    assert.ok(result.paybackMonths != null && result.paybackMonths < 24);
  });

  it("charges overage when runs exceed plan cap", () => {
    const within = computeEstimatedRoi({
      planId: "starter",
      pipelineRunsPerMonth: 40,
    });
    const over = computeEstimatedRoi({
      planId: "starter",
      pipelineRunsPerMonth: 50,
    });

    assert.equal(within.annualOverage, 0);
    assert.ok(over.annualOverage > 0);
    assert.ok(over.totalAnnualCost > within.totalAnnualCost);
  });

  it("enterprise tier has no overage cap", () => {
    const result = computeEstimatedRoi({
      planId: "enterprise",
      pipelineRunsPerMonth: 500,
    });
    assert.equal(result.annualOverage, 0);
  });
});
