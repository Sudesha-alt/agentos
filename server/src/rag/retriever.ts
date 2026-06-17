import type { PrdOutput } from "../types/agents";
import type { RetrievedContext, VectorContentType } from "../types/pipeline";
import { logger } from "../utils/logger";
import { TICKET_RETRIEVAL_CONFIGS } from "../codebaseIntelligence/retrievalConfig";
import {
  retrieveSimilarTickets,
  retrieveSimilarTicketsFormatted,
  ticketHitsToRetrievalResults,
} from "./ticketRetrievalService";

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
    contentTypes: ["ticket", "prd", "canary_finding", "org_intelligence", "company_intelligence"] as const,
    topK: TICKET_RETRIEVAL_CONFIGS.PRODUCT_AGENT.topK,
    similarityThreshold: TICKET_RETRIEVAL_CONFIGS.PRODUCT_AGENT.similarityThreshold,
  },
  ENGINEERING_AGENT: {
    contentTypes: ["prd", "implementation", "canary_finding", "org_intelligence"] as const,
    topK: TICKET_RETRIEVAL_CONFIGS.ENGINEERING_AGENT.topK,
    similarityThreshold: TICKET_RETRIEVAL_CONFIGS.ENGINEERING_AGENT.similarityThreshold,
  },
  QA_AGENT: {
    contentTypes: ["prd", "qa_report", "canary_finding", "org_intelligence"] as const,
    topK: TICKET_RETRIEVAL_CONFIGS.QA_AGENT.topK,
    similarityThreshold: TICKET_RETRIEVAL_CONFIGS.QA_AGENT.similarityThreshold,
  },
  PM_AGENT: {
    contentTypes: ["ticket", "prd", "implementation", "canary_finding", "org_intelligence", "company_intelligence"] as const,
    topK: TICKET_RETRIEVAL_CONFIGS.PM_AGENT.topK,
    similarityThreshold: TICKET_RETRIEVAL_CONFIGS.PM_AGENT.similarityThreshold,
  },
  COMPANY_CONTEXT: {
    contentTypes: [
      "ticket",
      "prd",
      "implementation",
      "org_intelligence",
      "company_intelligence",
      "canary_finding",
      "qa_report",
    ] as const,
    topK: 12,
    similarityThreshold: 0.62,
  },
};

export const retriever = {
  async retrieve(query: string, config: RetrievalConfig): Promise<RetrievalResult[]> {
    logger.info(
      {
        contentTypes: config.contentTypes,
        topK: config.topK,
        threshold: config.similarityThreshold,
      },
      "starting retrieval"
    );

    const hits = await retrieveSimilarTickets({
      summary: query,
      description: "",
      components: config.queryComponents ?? [],
      currentJiraKey: config.currentJiraKey,
      contentTypes: config.contentTypes,
      topN: config.topK,
    });

    const results = ticketHitsToRetrievalResults(hits).slice(0, config.topK);

    logger.info(
      {
        resultsFound: results.length,
        topSimilarity: results[0]?.similarity ?? 0,
      },
      "retrieval complete"
    );

    return results;
  },

  async retrieveForProductAgent(
    ticket: { summary: string; description: string; components?: string[] },
    currentJiraKey: string
  ): Promise<RetrievalResult[]> {
    const hits = await retrieveSimilarTickets({
      summary: ticket.summary,
      description: ticket.description,
      components: ticket.components,
      currentJiraKey,
      contentTypes: RETRIEVAL_CONFIGS.PRODUCT_AGENT.contentTypes,
      topN: RETRIEVAL_CONFIGS.PRODUCT_AGENT.topK,
    });
    return ticketHitsToRetrievalResults(hits);
  },

  async retrieveForPmAgent(
    ticket: {
      summary: string;
      description: string;
      components?: string[];
    },
    currentJiraKey: string
  ): Promise<RetrievalResult[]> {
    const hits = await retrieveSimilarTickets({
      summary: ticket.summary,
      description: ticket.description,
      components: ticket.components,
      currentJiraKey,
      contentTypes: RETRIEVAL_CONFIGS.PM_AGENT.contentTypes,
      topN: RETRIEVAL_CONFIGS.PM_AGENT.topK,
    });
    return ticketHitsToRetrievalResults(hits);
  },

  async retrieveForEngineeringAgent(
    prd: Pick<PrdOutput, "title" | "problemStatement" | "proposedSolution">,
    currentJiraKey: string
  ): Promise<RetrievalResult[]> {
    const hits = await retrieveSimilarTickets({
      summary: `${prd.title} ${prd.problemStatement}`,
      description: prd.proposedSolution,
      currentJiraKey,
      contentTypes: RETRIEVAL_CONFIGS.ENGINEERING_AGENT.contentTypes,
      topN: RETRIEVAL_CONFIGS.ENGINEERING_AGENT.topK,
    });
    return ticketHitsToRetrievalResults(hits);
  },

  async retrieveForCompanyProfile(query: string): Promise<RetrievalResult[]> {
    return this.retrieve(query, {
      ...RETRIEVAL_CONFIGS.COMPANY_CONTEXT,
      currentJiraKey: "_company_profile_",
      minResults: 0,
    });
  },

  async retrieveForQAAgent(
    prd: Pick<PrdOutput, "title" | "acceptanceCriteria">,
    currentJiraKey: string
  ): Promise<RetrievalResult[]> {
    const hits = await retrieveSimilarTickets({
      summary: prd.title,
      description: prd.acceptanceCriteria.join(" "),
      currentJiraKey,
      contentTypes: RETRIEVAL_CONFIGS.QA_AGENT.contentTypes,
      topN: RETRIEVAL_CONFIGS.QA_AGENT.topK,
    });
    return ticketHitsToRetrievalResults(hits);
  },
};

export { retrieveSimilarTicketsFormatted, retrieveSimilarTickets };
