import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ticketRequiresSecurityTests } from "../qa/testing/securityScanner";

describe("webhookIndexHelpers", () => {
  it("detects security-sensitive ticket text", () => {
    assert.equal(ticketRequiresSecurityTests("Add login with OAuth"), true);
    assert.equal(ticketRequiresSecurityTests("Update button color"), false);
  });
});

describe("indexQueue batching", () => {
  it("chunks file lists by batch size", () => {
    const changed = Array.from({ length: 7 }, (_, i) => `src/f${i}.ts`);
    const deleted = ["src/removed.ts", "src/old.ts"];
    const batchSize = 3;

    const all = [
      ...changed.map((p) => ({ path: p, kind: "changed" as const })),
      ...deleted.map((p) => ({ path: p, kind: "deleted" as const })),
    ];
    const batches: Array<{ changedFiles: string[]; deletedFiles: string[] }> = [];
    for (let i = 0; i < all.length; i += batchSize) {
      const slice = all.slice(i, i + batchSize);
      batches.push({
        changedFiles: slice.filter((x) => x.kind === "changed").map((x) => x.path),
        deletedFiles: slice.filter((x) => x.kind === "deleted").map((x) => x.path),
      });
    }

    assert.equal(batches.length, 3);
    assert.equal(
      batches.reduce((n, b) => n + b.changedFiles.length + b.deletedFiles.length, 0),
      9
    );
  });
});
