import type { PrdOutput } from "../types/agents";
import type { RetrievedContext, VectorContentType } from "../types/pipeline";
import { listJiraIssues } from "../jira-sync/issueRepository";
import { logger } from "../utils/logger";
import { embedder } from "./embedder";
import type { VectorRecord } from "./vectorStore";
import { vectorStore } from "./vectorStore";

export interface RetrievalConfig {
  contentTypes: readonly VectorContentType[];
  topK: number;
  similarityThreshold: number;
  currentJiraKey: string;
  minResults?: number;
  queryComponents?: string[];
}

export interface RetrievalResult extends RetrievedContext {
  source?: "vector" | "keyword_fallback";
}

export const RETRIEVAL_CONFIGS = {
  PRODUCT_AGENT: {
    contentTypes: ["ticket", "prd"] as const,
    topK: 6,
    similarityThreshold: 0.75,
  },
  ENGINEERING_AGENT: {
    contentTypes: ["prd", "implementation"] as const,
    topK: 5,
    similarityThreshold: 0.77,
  },
  QA_AGENT: {
    contentTypes: ["prd", "qa_report"] as const,
    topK: 5,
    similarityThreshold: 0.75,
  },
  PM_AGENT: {
    contentTypes: ["ticket", "prd", "implementation"] as const,
    topK: 8,
    similarityThreshold: 0.7,
  },
};

const MIN_RESULTS_DEFAULT = 2;
const THRESHOLD_RETRY_DELTA = 0.08;

export const retriever = {
  async retrieve(
    query: string,
    config: RetrievalConfig
  ): Promise<RetrievalResult[]> {
    const minResults = config.minResults ?? MIN_RESULTS_DEFAULT;

    logger.info(
      {
        contentTypes: config.contentTypes,
        topK: config.topK,
        threshold: config.similarityThreshold,
      },
      "starting retrieval"
    );

    let results = await this.searchVector(query, config);
    let fallbackUsed = false;

    if (results.length < minResults) {
      const relaxedThreshold = Math.max(
        0.5,
        config.similarityThreshold - THRESHOLD_RETRY_DELTA
      );
      logger.info(
        { relaxedThreshold, found: results.length },
        "retrieval retry with relaxed threshold"
      );
      results = await this.searchVector(query, {
        ...config,
        similarityThreshold: relaxedThreshold,
      });
    }

    if (results.length < minResults) {
      const keywordHits = await keywordFallback(query, config);
      if (keywordHits.length > 0) {
        results = [...results, ...keywordHits];
        fallbackUsed = true;
      }
    }

    const deduped = dedupeByJiraKey(results).slice(0, config.topK);

    logger.info(
      {
        resultsFound: deduped.length,
        topSimilarity: deduped[0]?.similarity ?? 0,
        fallbackUsed,
      },
      "retrieval complete"
    );

    return deduped;
  },

  async searchVector(
    query: string,
    config: RetrievalConfig
  ): Promise<RetrievalResult[]> {
    const queryEmbedding = await embedder.embed(query);

    const results = await vectorStore.similaritySearch(queryEmbedding, {
      contentTypes: [...config.contentTypes],
      topK: config.topK * 2,
      similarityThreshold: config.similarityThreshold,
      excludeJiraKeys: [config.currentJiraKey],
    });

    const scored = applyPostRetrievalScoring(results, query, config.queryComponents);

    return scored.map((r) => ({
      jiraTicketId: r.jiraTicketId,
      jiraKey: r.jiraKey,
      contentType: r.contentType,
      content: r.content,
      similarity: r.similarity ?? 0,
      metadata: r.metadata,
      source: "vector" as const,
    }));
  },

  async retrieveForProductAgent(
    ticket: { summary: string; description: string; components?: string[] },
    currentJiraKey: string
  ): Promise<RetrievalResult[]> {
    const query = `${ticket.summary} ${ticket.description}`;
    return this.retrieve(query, {
      ...RETRIEVAL_CONFIGS.PRODUCT_AGENT,
      currentJiraKey,
      queryComponents: ticket.components,
    });
  },

  async retrieveForPmAgent(
    ticket: {
      summary: string;
      description: string;
      components?: string[];
    },
    currentJiraKey: string
  ): Promise<RetrievalResult[]> {
    const query = [ticket.summary, ticket.description, ...(ticket.components ?? [])]
      .filter(Boolean)
      .join(" ");
    return this.retrieve(query, {
      ...RETRIEVAL_CONFIGS.PM_AGENT,
      currentJiraKey,
      queryComponents: ticket.components,
    });
  },

  async retrieveForEngineeringAgent(
    prd: Pick<PrdOutput, "title" | "problemStatement" | "proposedSolution">,
    currentJiraKey: string
  ): Promise<RetrievalResult[]> {
    const query = `${prd.title} ${prd.problemStatement} ${prd.proposedSolution}`;
    return this.retrieve(query, {
      ...RETRIEVAL_CONFIGS.ENGINEERING_AGENT,
      currentJiraKey,
    });
  },

  async retrieveForQAAgent(
    prd: Pick<PrdOutput, "title" | "acceptanceCriteria">,
    currentJiraKey: string
  ): Promise<RetrievalResult[]> {
    const query = `${prd.title} ${prd.acceptanceCriteria.join(" ")}`;
    return this.retrieve(query, {
      ...RETRIEVAL_CONFIGS.QA_AGENT,
      currentJiraKey,
    });
  },
};

async function keywordFallback(
  query: string,
  config: RetrievalConfig
): Promise<RetrievalResult[]> {
  const terms = query
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 3)
    .slice(0, 3);
  if (terms.length === 0) return [];

  try {
    const { items } = await listJiraIssues({
      q: terms[0],
      limit: config.topK,
    });

    return items
      .filter((i) => i.jiraKey !== config.currentJiraKey)
      .map((i) => ({
        jiraTicketId: i.jiraTicketId,
        jiraKey: i.jiraKey,
        contentType: "ticket" as VectorContentType,
        content: `TICKET: ${i.summary}\nDESCRIPTION: ${i.description.slice(0, 500)}`,
        similarity: 0.55,
        metadata: { source: "keyword_fallback", status: i.status },
        source: "keyword_fallback" as const,
      }));
  } catch (err) {
    logger.warn({ err }, "keyword fallback retrieval failed");
    return [];
  }
}

function dedupeByJiraKey(results: RetrievalResult[]): RetrievalResult[] {
  const best = new Map<string, RetrievalResult>();
  for (const r of results) {
    const key = `${r.jiraKey}:${r.contentType}`;
    const existing = best.get(key);
    if (!existing || r.similarity > existing.similarity) {
      best.set(key, r);
    }
  }
  return [...best.values()].sort((a, b) => b.similarity - a.similarity);
}

function applyPostRetrievalScoring(
  results: VectorRecord[],
  query: string,
  queryComponents?: string[]
): VectorRecord[] {
  const queryLower = query.toLowerCase();

  return results
    .map((result) => {
      let score = result.similarity ?? 0;

      if (result.contentType === "prd") score += 0.02;
      if (result.contentType === "implementation") score += 0.015;

      const age = getAgeInDays(result.metadata.embeddedAt);
      if (age < 30) score += 0.02;
      else if (age < 90) score += 0.01;

      const metaComponents = result.metadata.components;
      if (queryComponents?.length && Array.isArray(metaComponents)) {
        const overlap = queryComponents.some((c) =>
          (metaComponents as string[]).some(
            (mc) => mc.toLowerCase() === c.toLowerCase()
          )
        );
        if (overlap) score += 0.03;
      }

      const contentLower = result.content.toLowerCase();
      if (queryComponents?.some((c) => contentLower.includes(c.toLowerCase()))) {
        score += 0.02;
      }
      if (queryLower.split(/\s+/).some((w) => w.length > 4 && contentLower.includes(w))) {
        score += 0.01;
      }

      return { ...result, similarity: Math.min(score, 1.0) };
    })
    .sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));
}

function getAgeInDays(value: unknown): number {
  if (typeof value !== "string") return Number.POSITIVE_INFINITY;
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return Number.POSITIVE_INFINITY;
  return (Date.now() - then) / (1000 * 60 * 60 * 24);
}
