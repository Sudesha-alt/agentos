import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateVectorChunksToTickets,
  applyComponentBoost,
  filterTicketNoise,
  mergeJqlHits,
} from "./ticketRanker";
import type { VectorRecord } from "./vectorStore";

function chunkRow(
  jiraKey: string,
  similarity: number,
  chunkIndex = 0
): VectorRecord {
  return {
    id: `${jiraKey}-${chunkIndex}`,
    jiraTicketId: jiraKey,
    jiraKey,
    contentType: "ticket",
    content: `TICKET: Example ${jiraKey} billing checkout`,
    metadata: { summary: `Example ${jiraKey}`, status: "Open" },
    similarity,
    chunkIndex,
  };
}

describe("ticketRanker", () => {
  it("aggregates multi-chunk hits to best score per ticket", () => {
    const hits = aggregateVectorChunksToTickets([
      chunkRow("PROJ-1", 0.7, 0),
      chunkRow("PROJ-1", 0.82, 1),
      chunkRow("PROJ-2", 0.75, 0),
    ]);
    assert.equal(hits.length, 2);
    assert.equal(hits[0]?.jiraKey, "PROJ-1");
    assert.equal(hits[0]?.score, 0.82);
  });

  it("merges JQL hits without duplicating vector matches", () => {
    const vector = aggregateVectorChunksToTickets([chunkRow("PROJ-1", 0.8)]);
    const merged = mergeJqlHits(
      vector,
      [
        {
          jiraKey: "PROJ-2",
          summary: "Related bug",
          status: "Open",
          issueType: "Bug",
          source: "jql",
        },
      ],
      new Set(["PROJ-1"])
    );
    assert.ok(merged.some((h) => h.jiraKey === "PROJ-2"));
    assert.ok(merged.some((h) => h.jiraKey === "PROJ-1"));
  });

  it("boosts component overlap", () => {
    const hits = applyComponentBoost(
      aggregateVectorChunksToTickets([chunkRow("PROJ-1", 0.7)]),
      ["billing"]
    );
    assert.ok(hits[0]?.matchReasons.includes("component"));
    assert.ok((hits[0]?.score ?? 0) > 0.7);
  });

  it("filters low-score and stale closed bugs", () => {
    const hits = filterTicketNoise(
      [
        {
          jiraKey: "PROJ-1",
          contentType: "ticket",
          score: 0.9,
          content: "TICKET: Auth fix",
          matchReasons: ["semantic"],
          status: "Open",
          source: "vector",
        },
        {
          jiraKey: "PROJ-2",
          contentType: "ticket",
          score: 0.65,
          content: "bug in billing",
          matchReasons: ["semantic"],
          status: "Closed",
          source: "vector",
        },
      ],
      { ticketText: "auth login", thresholdOffset: 0 }
    );
    assert.deepEqual(
      hits.map((h) => h.jiraKey),
      ["PROJ-1"]
    );
  });
});
