import type { VectorContentType } from "../types/pipeline";
import { jiraTool } from "../tools/jiraTool";
import { listJiraIssues } from "../jira-sync/issueRepository";
import { logger } from "../utils/logger";
import {
  TICKET_AGGREGATE_TOP_N,
  TICKET_CHUNK_FETCH_THRESHOLD,
  TICKET_CHUNK_FETCH_TOP_K,
  TICKET_PRESENT_THRESHOLD,
} from "../codebaseIntelligence/retrievalConfig";
import { fetchJqlRelatedTickets } from "./jqlTicketFetcher";
import { embedder } from "./embedder";
import { expandTicketQueries, buildJqlQueries, type TicketQueryInput } from "./ticketQueryExpander";
import {
  aggregateVectorChunksToTickets,
  applyComponentBoost,
  filterTicketNoise,
  formatTicketHitsList,
  mergeJqlHits,
  resolveThresholdOffset,
  type TicketHit,
} from "./ticketRanker";
import { vectorStore } from "./vectorStore";
import type { RetrievalConfig, RetrievalResult } from "./retriever";

export interface RetrieveSimilarTicketsInput extends TicketQueryInput {
  currentJiraKey: string;
  contentTypes?: readonly VectorContentType[];
  topN?: number;
  includeJql?: boolean;
  includeJiraGraph?: boolean;
}

export async function retrieveSimilarTickets(
  input: RetrieveSimilarTicketsInput
): Promise<TicketHit[]> {
  const contentTypes = input.contentTypes ?? [
    "ticket",
    "prd",
    "implementation",
    "qa_report",
    "canary_finding",
  ];
  const topN = input.topN ?? TICKET_AGGREGATE_TOP_N;
  const thresholdOffset = resolveThresholdOffset(input.components ?? []);
  const fetchThreshold = Math.max(
    0.45,
    TICKET_CHUNK_FETCH_THRESHOLD + thresholdOffset
  );

  const queries = await expandTicketQueries(input);
  const queryEmbeddings = await embedder.embedBatch(queries);
  const vectorRows = await Promise.all(
    queries.map(async (query, index) => {
      const embedding = queryEmbeddings[index];
      if (!embedding) return [];
      return vectorStore.similaritySearch(embedding, {
        contentTypes: [...contentTypes],
        topK: TICKET_CHUNK_FETCH_TOP_K,
        similarityThreshold: fetchThreshold,
        excludeJiraKeys: [input.currentJiraKey],
        queryText: query,
        useHybrid: true,
      });
    })
  );

  let hits = aggregateVectorChunksToTickets(vectorRows.flat());
  hits = applyComponentBoost(hits, input.components ?? []);

  const jqlKeys = new Set(hits.map((h) => h.jiraKey));

  if (input.includeJql !== false) {
    const jqlQueries = buildJqlQueries(input, input.currentJiraKey);
    const jqlHits = await fetchJqlRelatedTickets(jqlQueries, 8);
    hits = mergeJqlHits(hits, jqlHits, jqlKeys);
  }

  if (input.includeJiraGraph !== false) {
    try {
      const related = await jiraTool.fetchRelated({
        jiraKey: input.currentJiraKey,
        relationshipTypes: ["linked", "same_components", "epic_children"],
      });
      hits = mergeJqlHits(
        hits,
        related.tickets.map((t) => ({
          jiraKey: t.key,
          summary: t.summary,
          status: t.status,
          issueType: t.type,
          source: "jql" as const,
        })),
        jqlKeys
      );
    } catch (err) {
      logger.debug({ err }, "Jira graph fetch skipped in ticket retrieval");
    }
  }

  if (hits.length < 2) {
    const keyword = await keywordTicketFallback(input, contentTypes);
    hits = [...hits, ...keyword];
  }

  const ticketText = [input.summary, input.description ?? ""].join(" ");
  hits = filterTicketNoise(hits, { ticketText, thresholdOffset });

  logger.info(
    {
      jiraKey: input.currentJiraKey,
      hitCount: hits.length,
      topScore: hits[0]?.score,
      queryCount: queries.length,
    },
    "retrieveSimilarTickets complete"
  );

  return hits.slice(0, topN);
}

async function keywordTicketFallback(
  input: RetrieveSimilarTicketsInput,
  contentTypes: readonly VectorContentType[]
): Promise<TicketHit[]> {
  const terms = [
    ...(input.components ?? []),
    ...input.summary.split(/\s+/).filter((w) => w.length > 4),
  ].slice(0, 2);
  if (!terms.length) return [];

  const { items } = await listJiraIssues({ q: terms[0], limit: 8 });
  return items
    .filter((i) => i.jiraKey !== input.currentJiraKey)
    .filter((i) => contentTypes.includes("ticket"))
    .map((i) => ({
      jiraKey: i.jiraKey,
      contentType: "ticket" as const,
      score: TICKET_PRESENT_THRESHOLD - 0.05,
      content: `TICKET: ${i.summary}\nDESCRIPTION: ${i.description.slice(0, 400)}`,
      matchReasons: ["keyword"],
      summary: i.summary,
      status: i.status,
      source: "keyword" as const,
    }));
}

export function ticketHitsToRetrievalResults(hits: TicketHit[]): RetrievalResult[] {
  return hits.map((h) => ({
    jiraTicketId: h.jiraKey,
    jiraKey: h.jiraKey,
    contentType: h.contentType,
    content: h.content,
    similarity: h.score,
    metadata: {
      matchReasons: h.matchReasons,
      source: h.source,
      summary: h.summary,
      status: h.status,
    },
    source: h.source === "vector" ? "vector" : "keyword_fallback",
  }));
}

export async function retrieveSimilarTicketsFormatted(
  input: RetrieveSimilarTicketsInput
): Promise<{ hits: TicketHit[]; formatted: string }> {
  const hits = await retrieveSimilarTickets(input);
  return { hits, formatted: formatTicketHitsList(hits) };
}

export async function retrieveWithConfig(
  query: string,
  config: RetrievalConfig
): Promise<RetrievalResult[]> {
  const parts = query.split(/\s+/);
  const hits = await retrieveSimilarTickets({
    summary: query,
    description: "",
    components: config.queryComponents ?? [],
    currentJiraKey: config.currentJiraKey,
    contentTypes: config.contentTypes,
    topN: config.topK,
  });
  return ticketHitsToRetrievalResults(hits).slice(0, config.topK);
}
