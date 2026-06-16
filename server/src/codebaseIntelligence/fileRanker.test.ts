import { describe, expect, it } from "vitest";
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

    expect(aggregated).toHaveLength(1);
    expect(aggregated[0]?.path).toBe("server/src/billing/checkout.ts");
    expect(aggregated[0]?.score).toBeGreaterThan(0.7);
    expect(aggregated[0]?.bestChunk).toBe("header chunk");
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
    expect(scope).toBe("context_only");
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
    expect(scope).toBe("create_new");
  });

  it("labels indexed hit as modify", () => {
    const scope = classifyChangeScope(baseHit, {
      topModifyScore: 0.8,
      ticketText: "billing",
      indexed: true,
      patterns: [],
    });
    expect(scope).toBe("modify");
  });
});

describe("expandQueryRules", () => {
  it("extracts components and domain terms", () => {
    const phrases = expandQueryRules({
      summary: "Fix auth session timeout",
      components: ["Billing"],
    });
    expect(phrases.some((p) => /auth/i.test(p))).toBe(true);
    expect(phrases.some((p) => /Billing/i.test(p))).toBe(true);
  });
});

describe("mergeWorkFileResults", () => {
  it("keeps max score per path", async () => {
    const merged = await mergeWorkFileResults([
      [{ path: "a.ts", changeScope: "modify", score: 0.7, matchReasons: ["semantic"] }],
      [{ path: "a.ts", changeScope: "modify", score: 0.85, matchReasons: ["keyword_path"] }],
    ]);
    expect(merged[0]?.score).toBe(0.85);
    expect(merged[0]?.matchReasons).toContain("keyword_path");
  });
});
