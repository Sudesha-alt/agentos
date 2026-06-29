import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  findMissingContentDeliverables,
  reconcileContentDeliverables,
  resolveContentDeliverablePaths,
} from "./contentDeliverables";
import { workspaceWriteFile } from "./engineeringWorkspace";

describe("resolveContentDeliverablePaths", () => {
  it("prefers PRD deliverableFiles over implementation targetFiles", () => {
    const paths = resolveContentDeliverablePaths({
      deliverableFiles: [{ path: "docs/curriculum/foundation-12-weeks.md" }],
      targetFilePaths: ["docs/curriculum/foundation-12-weeks.md"],
      implementationTargetFiles: ["docs/curriculum/wrong-name.md"],
    });
    assert.deepEqual(paths, ["docs/curriculum/foundation-12-weeks.md"]);
  });

  it("falls back to implementation targetFiles when PRD has none", () => {
    const paths = resolveContentDeliverablePaths({
      deliverableFiles: [],
      targetFilePaths: [],
      implementationTargetFiles: ["docs/a.md"],
    });
    assert.deepEqual(paths, ["docs/a.md"]);
  });
});

describe("reconcileContentDeliverables", () => {
  it("copies single wrong-path write to required PRD path", () => {
    const dir = mkdtempSync(join(tmpdir(), "agentos-reconcile-"));
    try {
      workspaceWriteFile(dir, "docs/wrong.md", "# Curriculum");
      const ok = reconcileContentDeliverables(
        dir,
        ["docs/curriculum/foundation-12-weeks.md"],
        [{ path: "docs/wrong.md", status: "added" }]
      );
      assert.equal(ok, true);
      const missing = findMissingContentDeliverables(
        ["docs/curriculum/foundation-12-weeks.md"],
        new Set(["docs/curriculum/foundation-12-weeks.md"]),
        ["docs/curriculum/foundation-12-weeks.md"],
        dir
      );
      assert.deepEqual(missing, []);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
