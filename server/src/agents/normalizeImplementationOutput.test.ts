import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeImplementationOutput } from "./normalizeImplementationOutput";
import type { ImplementationOutput } from "../types/agents";

describe("normalizeImplementationOutput", () => {
  it("fills content-mode defaults and targetFiles", () => {
    const normalized = normalizeImplementationOutput(
      {
        summary: "Update curriculum markdown for Q1 through Q3.",
        technicalApproach: "Author a single markdown file with monthly sections.",
        components: [],
        apiChanges: ["POST /api/x"],
        databaseChanges: [],
        dependencies: [],
        risks: [],
        totalEstimateDays: 0,
        criteriaMapping: [
          {
            criterion: "Month 1 topics listed",
            implementation: "Section in docs/curriculum/q1.md",
          },
        ],
        blockers: [],
        confidenceScore: 0.8,
        confidenceReason: "Straightforward doc update",
      },
      "content",
      ["docs/curriculum/q1.md"]
    );

    assert.equal(normalized.implementationMode, "content");
    assert.deepEqual(normalized.targetFiles, ["docs/curriculum/q1.md"]);
    assert.deepEqual(normalized.apiChanges, []);
    assert.ok(normalized.components.length >= 1);
    assert.ok(normalized.totalEstimateDays >= 0.25);
  });
});
