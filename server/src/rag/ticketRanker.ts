import type { VectorContentType } from "../types/pipeline";
import type { VectorRecord } from "./vectorStore";
import type { JqlTicketHit } from "./jqlTicketFetcher";
import {
  TICKET_COMPONENT_BOOST,
  TICKET_HIGH_CONFIDENCE,
  TICKET_JQL_BOOST,
  TICKET_PRESENT_THRESHOLD,
} from "../codebaseIntelligence/retrievalConfig";
import { getTicketThresholdOffset } from "./retrievalLearning";

export interface TicketHit {
  jiraKey: string;
  contentType: VectorContentType;
  score: number;
  content: string;
  matchReasons: string[];
  summary?: string;
  status?: string;
  source: "vector" | "jql" | "keyword";
}

export function aggregateVectorChunksToTickets(rows: VectorRecord[]): TicketHit[] {
  const byKey = new Map<string, TicketHit>();

  for (const row of rows) {
    const similarity = row.similarity ?? 0;
    const existing = byKey.get(`${row.jiraKey}:${row.contentType}`);
    const reasons = ["semantic"];
    if ((row.chunkIndex ?? 0) === 0) reasons.push("header_chunk");

    if (!existing || similarity > existing.score) {
      byKey.set(`${row.jiraKey}:${row.contentType}`, {
        jiraKey: row.jiraKey,
        contentType: row.contentType,
        score: similarity,
        content: row.content,
        matchReasons: reasons,
        summary: typeof row.metadata.summary === "string" ? row.metadata.summary : undefined,
        status: typeof row.metadata.status === "string" ? row.metadata.status : undefined,
        source: "vector",
      });
    }
  }

  return [...byKey.values()].sort((a, b) => b.score - a.score);
}

export function mergeJqlHits(
  hits: TicketHit[],
  jqlHits: JqlTicketHit[],
  knownKeys: Set<string>
): TicketHit[] {
  const byKeyType = new Map<string, TicketHit>();
  for (const h of hits) {
    byKeyType.set(`${h.jiraKey}:${h.contentType}`, h);
  }

  for (const jql of jqlHits) {
    if (knownKeys.has(jql.jiraKey)) continue;
    const key = `${jql.jiraKey}:ticket`;
    const existing = byKeyType.get(key);
    const jqlScore = TICKET_PRESENT_THRESHOLD + TICKET_JQL_BOOST;
    if (!existing) {
      byKeyType.set(key, {
        jiraKey: jql.jiraKey,
        contentType: "ticket",
        score: jqlScore,
        content: `TICKET: ${jql.summary}\nSTATUS: ${jql.status}\nTYPE: ${jql.issueType}`,
        matchReasons: ["jql"],
        summary: jql.summary,
        status: jql.status,
        source: "jql",
      });
    } else if (!existing.matchReasons.includes("jql")) {
      existing.score = Math.min(1, existing.score + TICKET_JQL_BOOST);
      existing.matchReasons.push("jql");
    }
  }

  return [...byKeyType.values()].sort((a, b) => b.score - a.score);
}

export function applyComponentBoost(
  hits: TicketHit[],
  components: string[]
): TicketHit[] {
  if (!components.length) return hits;
  return hits.map((h) => {
    const metaComponents = h.content.toLowerCase();
    const overlap = components.some((c) => metaComponents.includes(c.toLowerCase()));
    if (!overlap) return h;
    return {
      ...h,
      score: Math.min(1, h.score + TICKET_COMPONENT_BOOST),
      matchReasons: [...new Set([...h.matchReasons, "component"])],
    };
  });
}

export function filterTicketNoise(
  hits: TicketHit[],
  opts: { ticketText: string; thresholdOffset?: number }
): TicketHit[] {
  const floor =
    TICKET_PRESENT_THRESHOLD + (opts.thresholdOffset ?? 0);
  const mentionsTest = /\btest(s)?\b|\bspec\b|\bcoverage\b/i.test(opts.ticketText);
  const topScore = hits[0]?.score ?? 0;

  return hits.filter((h) => {
    if (h.score < floor) return false;
    if (
      /bug/i.test(h.content) &&
      /done|closed|resolved/i.test(h.status ?? "") &&
      h.score < topScore * 0.85
    ) {
      return false;
    }
    if (!mentionsTest && /\btest\b|\bspec\b/i.test(h.content) && h.score < topScore * 0.9) {
      return false;
    }
    return true;
  });
}

export function formatTicketHitsList(hits: TicketHit[]): string {
  if (!hits.length) return "none found";
  return hits
    .map((h) => {
      const scope =
        h.contentType === "implementation"
          ? "impl"
          : h.contentType === "prd"
            ? "prd"
            : h.contentType;
      const reasons = h.matchReasons.join(", ");
      const snippet = h.content.replace(/\s+/g, " ").slice(0, 120);
      return `${h.jiraKey} [${scope}, ${h.source}, sim=${h.score.toFixed(2)}, ${reasons}]: ${snippet}`;
    })
    .join("\n");
}

export function resolveThresholdOffset(components: string[]): number {
  return getTicketThresholdOffset(components);
}

export { TICKET_HIGH_CONFIDENCE };
