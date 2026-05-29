import { describe, expect, it } from "vitest";
import { hasDiscoveryContent, parseDiscoveryOutput } from "./parseDiscoveryOutput";

describe("parseDiscoveryOutput", () => {
  it("parses full discovery shape", () => {
    const parsed = parseDiscoveryOutput({
      prd: { title: "T", confidenceScore: 0.8 },
      discovery: {
        ticketAnalysis: { coreIntent: "intent" },
        gapAnalysis: { totalGaps: 3 },
      },
    });
    expect(parsed.mode).toBe("full");
    expect(parsed.ticketAnalysis.coreIntent).toBe("intent");
    expect(hasDiscoveryContent(parsed)).toBe(true);
  });

  it("parses legacy flat PRD", () => {
    const parsed = parseDiscoveryOutput({
      title: "Legacy",
      problemStatement: "A long enough problem statement for tests.",
      proposedSolution: "A long enough proposed solution for tests.",
      confidenceScore: 0.7,
    });
    expect(parsed.mode).toBe("legacy");
    expect(parsed.prd.title).toBe("Legacy");
  });
});
