import type { PrdOutput } from "../types/agents";
import type { RetrievedContext, VectorContentType } from "../types/pipeline";
import { logger } from "../utils/logger";
import { embedder } from "./embedder";
import type { VectorRecord } from "./vectorStore";
import { vectorStore } from "./vectorStore";

export interface RetrievalConfig {
  contentTypes: readonly VectorContentType[];
  topK: number;
  similarityThreshold: number;
  currentJiraKey: string;
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
};

export const retriever = {
  async retrieve(
    query: string,
    config: RetrievalConfig
  ): Promise<RetrievedContext[]> {
    logger.info(
      {
        contentTypes: config.contentTypes,
        topK: config.topK,
        threshold: config.similarityThreshold,
      },
      "starting retrieval"
    );

    const queryEmbedding = await embedder.embed(query);

    const results = await vectorStore.similaritySearch(queryEmbedding, {
      contentTypes: [...config.contentTypes],
      topK: config.topK,
      similarityThreshold: config.similarityThreshold,
      excludeJiraKeys: [config.currentJiraKey],
    });

    logger.info(
      {
        resultsFound: results.length,
        topSimilarity: results[0]?.similarity ?? 0,
      },
      "retrieval complete"
    );

    const scored = applyPostRetrievalScoring(results);

    return scored.map((r) => ({
      jiraTicketId: r.jiraTicketId,
      jiraKey: r.jiraKey,
      contentType: r.contentType,
      content: r.content,
      similarity: r.similarity ?? 0,
      metadata: r.metadata,
    }));
  },

  async retrieveForProductAgent(
    ticket: { summary: string; description: string },
    currentJiraKey: string
  ): Promise<RetrievedContext[]> {
    const query = `${ticket.summary} ${ticket.description}`;
    return this.retrieve(query, {
      ...RETRIEVAL_CONFIGS.PRODUCT_AGENT,
      currentJiraKey,
    });
  },

  async retrieveForEngineeringAgent(
    prd: Pick<PrdOutput, "title" | "problemStatement" | "proposedSolution">,
    currentJiraKey: string
  ): Promise<RetrievedContext[]> {
    const query = `${prd.title} ${prd.problemStatement} ${prd.proposedSolution}`;
    return this.retrieve(query, {
      ...RETRIEVAL_CONFIGS.ENGINEERING_AGENT,
      currentJiraKey,
    });
  },

  async retrieveForQAAgent(
    prd: Pick<PrdOutput, "title" | "acceptanceCriteria">,
    currentJiraKey: string
  ): Promise<RetrievedContext[]> {
    const query = `${prd.title} ${prd.acceptanceCriteria.join(" ")}`;
    return this.retrieve(query, {
      ...RETRIEVAL_CONFIGS.QA_AGENT,
      currentJiraKey,
    });
  },
};

function applyPostRetrievalScoring(results: VectorRecord[]): VectorRecord[] {
  return results
    .map((result) => {
      let score = result.similarity ?? 0;

      if (result.contentType === "prd") score += 0.02;

      const age = getAgeInDays(result.metadata.embeddedAt);
      if (age < 30) score += 0.02;
      else if (age < 90) score += 0.01;

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
