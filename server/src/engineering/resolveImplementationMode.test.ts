import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  resolveDeliverableFiles,
  resolveImplementationMode,
} from "./resolveImplementationMode";
import type { GeneratedPRD } from "../prd/prdGenerator";

describe("resolveImplementationMode", () => {
  it("respects explicit PRD implementationMode", () => {
    const generatedPrd = { implementationMode: "content" } as GeneratedPRD;
    assert.equal(
      resolveImplementationMode({ generatedPrd, ticket: { summary: "Fix bug", description: "", labels: [] } }),
      "content"
    );
  });

  it("uses agentos:content label override", () => {
    assert.equal(
      resolveImplementationMode({
        ticket: {
          summary: "Minor tweak",
          description: "",
          labels: ["agentos:content"],
        },
      }),
      "content"
    );
  });

  it("infers content from curriculum keywords when no endpoints", () => {
    assert.equal(
      resolveImplementationMode({
        generatedPrd: {
          technicalRequirements: { endpoints: [] },
        } as GeneratedPRD,
        ticket: {
          summary: "Updated curriculum for Q1",
          description: "Refresh the first three months curriculum",
          labels: [],
        },
      }),
      "content"
    );
  });

  it("returns deliverableFiles from generated PRD", () => {
    const files = resolveDeliverableFiles({
      generatedPrd: {
        implementationMode: "content",
        deliverableFiles: [
          { path: "docs/curriculum/q1.md", format: "markdown", purpose: "Q1 plan" },
        ],
      } as GeneratedPRD,
    });
    assert.equal(files.length, 1);
    assert.equal(files[0]?.path, "docs/curriculum/q1.md");
  });
});
