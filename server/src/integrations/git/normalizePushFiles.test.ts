import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizePushFiles,
  resolveToolFilePath,
} from "./normalizePushFiles";

describe("resolveToolFilePath", () => {
  it("reads file_path, path, and filePath aliases", () => {
    assert.equal(resolveToolFilePath({ file_path: "docs/a.md" }), "docs/a.md");
    assert.equal(resolveToolFilePath({ path: "docs/b.md" }), "docs/b.md");
    assert.equal(resolveToolFilePath({ filePath: "docs/c.md" }), "docs/c.md");
  });

  it("returns empty when no path is provided", () => {
    assert.equal(resolveToolFilePath({ content: "x" }), "");
  });
});

describe("normalizePushFiles", () => {
  it("rejects blank paths before GitHub tree creation", () => {
    assert.throws(
      () =>
        normalizePushFiles([
          { filePath: "", content: "hello" },
          { filePath: "docs/ok.md", content: "ok" },
        ]),
      /blank paths/
    );
  });

  it("dedupes by normalized path", () => {
    const files = normalizePushFiles([
      { filePath: "docs/a.md", content: "v1" },
      { filePath: "docs/a.md", content: "v2" },
    ]);
    assert.equal(files.length, 1);
    assert.equal(files[0]?.content, "v2");
  });
});
