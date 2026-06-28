import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LEGACY_API_PUSH_BRANCH,
  resolveEngineeringBranchName,
  resolveFallbackApiPushBranch,
} from "../engineering/engineeringWorkspace";
import { resolveQaBranchName } from "../qaAgent/inputBuilder";

describe("resolveQaBranchName", () => {
  it("prefers Ananta implementation branch over defaults", () => {
    assert.equal(resolveQaBranchName("agentos/ag-61"), "agentos/ag-61");
    assert.equal(resolveQaBranchName("work/agentos"), "work/agentos");
  });

  it("derives per-ticket branch naming from jira key", () => {
    assert.equal(resolveEngineeringBranchName("AG-61"), "agentos/ag-61");
  });

  it("falls back to legacy API push branch before main", () => {
    assert.equal(resolveFallbackApiPushBranch(), LEGACY_API_PUSH_BRANCH);
    assert.equal(resolveQaBranchName(undefined, "AG-99"), "agentos/ag-99");
  });
});
