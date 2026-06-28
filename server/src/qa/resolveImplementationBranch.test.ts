import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveEngineeringBranchName } from "../engineering/engineeringWorkspace";
import { resolveQaBranchName } from "../qaAgent/inputBuilder";

describe("resolveQaBranchName", () => {
  it("prefers Ananta implementation branch over defaults", () => {
    assert.equal(resolveQaBranchName("agentos/ag-61"), "agentos/ag-61");
  });

  it("derives per-ticket branch naming from jira key", () => {
    assert.equal(resolveEngineeringBranchName("AG-61"), "agentos/ag-61");
  });
});
