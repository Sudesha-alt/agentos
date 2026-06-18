import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateChunksToFiles,
  classifyChangeScope,
  mergeWorkFileResults,
} from "./fileRanker";
import { expandQueryRules } from "./queryExpander";

describe("aggregateChunksToFiles", () => {
  it("dedupes multiple chunks per file using max similarity", () => {
    const aggregated = aggregateChunksToFiles(
      [
        {
          file_path: "server/src/billing/checkout.ts",
          chunk_index: 1,
          similarity: 0.7,
          chunk_content: "chunk b",
        },
        {
          file_path: "server/src/billing/checkout.ts",
          chunk_index: 0,
          similarity: 0.82,
          chunk_content: "header chunk",
        },
      ],
      "billing checkout"
    );

    assert.equal(aggregated.length, 1);
    assert.equal(aggregated[0]?.path, "server/src/billing/checkout.ts");
    assert.ok((aggregated[0]?.score ?? 0) > 0.7);
    assert.equal(aggregated[0]?.bestChunk, "header chunk");
  });
});

describe("classifyChangeScope", () => {
  const baseHit = {
    path: "server/src/foo.ts",
    score: 0.75,
    matchReasons: ["semantic"],
    bestChunk: "code",
    bestChunkIndex: 0,
    summary: "svc",
    patterns: [] as string[],
    indexed: true,
  };

  it("demotes test files when ticket does not mention tests", () => {
    const scope = classifyChangeScope(
      { ...baseHit, path: "server/src/foo.test.ts", score: 0.66, patterns: ["test"] },
      {
        topModifyScore: 0.8,
        ticketText: "billing checkout",
        indexed: true,
        patterns: ["test"],
      }
    );
    assert.equal(scope, "context_only");
  });

  it("labels unindexed high-score path as create_new", () => {
    const scope = classifyChangeScope(
      { ...baseHit, path: "server/src/billing/newModule.ts", indexed: false },
      {
        topModifyScore: 0.8,
        ticketText: "billing",
        indexed: false,
        patterns: [],
      }
    );
    assert.equal(scope, "create_new");
  });

  it("labels indexed hit as modify", () => {
    const scope = classifyChangeScope(baseHit, {
      topModifyScore: 0.8,
      ticketText: "billing",
      indexed: true,
      patterns: [],
    });
    assert.equal(scope, "modify");
  });
});

describe("expandQueryRules", () => {
  it("extracts components and domain terms", () => {
    const phrases = expandQueryRules({
      summary: "Fix auth session timeout",
      components: ["Billing"],
    });
    assert.ok(phrases.some((p) => /auth/i.test(p)));
    assert.ok(phrases.some((p) => /Billing/i.test(p)));
  });
});

describe("mergeWorkFileResults", () => {
  it("keeps max score per path", async () => {
    const merged = await mergeWorkFileResults([
      [{ path: "a.ts", changeScope: "modify", score: 0.7, matchReasons: ["semantic"] }],
      [{ path: "a.ts", changeScope: "modify", score: 0.85, matchReasons: ["keyword_path"] }],
    ]);
    assert.equal(merged[0]?.score, 0.85);
    assert.ok(merged[0]?.matchReasons.includes("keyword_path"));
  });
});
