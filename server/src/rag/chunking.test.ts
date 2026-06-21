import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chunkTextByTokens, countTokens, truncateToTokenBudget } from "./chunking";

describe("chunkTextByTokens", () => {
  it("splits long text into token-bounded chunks", () => {
    const text = Array.from({ length: 20 }, (_, i) => `Paragraph ${i} with some content.`).join(
      "\n\n"
    );
    const chunks = chunkTextByTokens(text, { maxTokens: 50, overlapTokens: 5 });
    assert.ok(chunks.length > 1);
    for (const chunk of chunks) {
      assert.ok(countTokens(chunk) <= 50);
    }
  });

  it("truncateToTokenBudget caps at limit", () => {
    const long = "word ".repeat(20_000);
    const truncated = truncateToTokenBudget(long, 100);
    assert.ok(countTokens(truncated) <= 100);
  });
});
