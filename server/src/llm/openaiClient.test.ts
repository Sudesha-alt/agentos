import { describe, expect, it } from "vitest";
import { openAIChatTokenLimit } from "./openaiClient";

describe("openAIChatTokenLimit", () => {
  it("always returns max_completion_tokens for GPT-5+ compatibility", () => {
    expect(openAIChatTokenLimit(4000)).toEqual({ max_completion_tokens: 4000 });
    expect(openAIChatTokenLimit(8000)).toEqual({ max_completion_tokens: 8000 });
  });
});
