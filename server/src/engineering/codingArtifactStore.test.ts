import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clearCodingArtifacts,
  markCodingFileWritten,
  resolveWriteTargetPath,
  setCodingDeliverablePaths,
} from "./codingArtifactStore";

describe("resolveWriteTargetPath", () => {
  const pipelineId = "test-pipeline-write-path";

  it("uses explicit file_path when multiple deliverables", () => {
    clearCodingArtifacts(pipelineId);
    setCodingDeliverablePaths(pipelineId, ["docs/a.md", "docs/b.md"]);
    const resolved = resolveWriteTargetPath(pipelineId, {
      file_path: "docs/b.md",
    });
    assert.equal(resolved?.filePath, "docs/b.md");
    assert.equal(resolved?.inferred, false);
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
    assert.equal(resolved?.filePath, "docs/curriculum/foundation-12-weeks.md");
    assert.equal(resolved?.inferred, true);
    clearCodingArtifacts(pipelineId);
  });

  it("redirects wrong explicit path to single PRD deliverable", () => {
    clearCodingArtifacts(pipelineId);
    setCodingDeliverablePaths(pipelineId, [
      "docs/curriculum/foundation-12-weeks.md",
    ]);
    const resolved = resolveWriteTargetPath(pipelineId, {
      file_path: "docs/curriculum/wrong-name.md",
      content: "# Curriculum",
    });
    assert.deepEqual(resolved, {
      filePath: "docs/curriculum/foundation-12-weeks.md",
      inferred: false,
      redirected: true,
    });
    clearCodingArtifacts(pipelineId);
  });

  it("redirects to sole remaining deliverable when explicit path is unknown", () => {
    clearCodingArtifacts(pipelineId);
    setCodingDeliverablePaths(pipelineId, [
      "docs/a.md",
      "docs/b.md",
    ]);
    markCodingFileWritten(pipelineId, "docs/a.md");
    const resolved = resolveWriteTargetPath(pipelineId, {
      file_path: "docs/typo.md",
      content: "x",
    });
    assert.deepEqual(resolved, {
      filePath: "docs/b.md",
      inferred: false,
      redirected: true,
    });
    clearCodingArtifacts(pipelineId);
  });

  it("returns null when no path and no deliverables configured", () => {
    clearCodingArtifacts(pipelineId);
    assert.equal(resolveWriteTargetPath(pipelineId, { content: "x" }), null);
  });
});
