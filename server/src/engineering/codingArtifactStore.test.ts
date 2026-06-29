import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clearCodingArtifacts,
  resolveWriteTargetPath,
  setCodingDeliverablePaths,
} from "./codingArtifactStore";

describe("resolveWriteTargetPath", () => {
  const pipelineId = "test-pipeline-write-path";

  it("uses explicit file_path when provided", () => {
    clearCodingArtifacts(pipelineId);
    setCodingDeliverablePaths(pipelineId, ["docs/a.md"]);
    const resolved = resolveWriteTargetPath(pipelineId, {
      file_path: "docs/b.md",
    });
    assert.deepEqual(resolved, { filePath: "docs/b.md", inferred: false });
    clearCodingArtifacts(pipelineId);
  });

  it("infers PRD deliverable when file_path is omitted", () => {
    clearCodingArtifacts(pipelineId);
    setCodingDeliverablePaths(pipelineId, [
      "docs/curriculum/foundation-12-weeks.md",
    ]);
    const resolved = resolveWriteTargetPath(pipelineId, {
      content: "# Curriculum",
      summary: "weeks",
    });
    assert.deepEqual(resolved, {
      filePath: "docs/curriculum/foundation-12-weeks.md",
      inferred: true,
    });
    clearCodingArtifacts(pipelineId);
  });

  it("returns null when no path and no deliverables configured", () => {
    clearCodingArtifacts(pipelineId);
    assert.equal(resolveWriteTargetPath(pipelineId, { content: "x" }), null);
  });
});
