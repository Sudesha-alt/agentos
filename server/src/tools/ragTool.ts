import type { VectorContentType } from "../types/pipeline";
import { embedder } from "../rag/embedder";
import { vectorStore } from "../rag/vectorStore";
import { logger } from "../utils/logger";

interface RAGSearchInput {
  query: string;
  contentTypes: VectorContentType[];
  topK: number;
  similarityThreshold: number;
  excludeJiraKey: string;
}

interface RAGSearchItem {
  jiraKey: string;
  contentType: VectorContentType;
  content: string;
  similarity: number;
  metadata: Record<string, unknown>;
}

export interface RAGSearchResult {
  results: RAGSearchItem[];
  queryUsed: string;
  totalFound: number;
}

export const ragTool = {
  async search(input: RAGSearchInput): Promise<RAGSearchResult> {
    logger.info(
      {
        queryPreview: input.query.slice(0, 120),
        contentTypes: input.contentTypes,
        topK: input.topK,
        similarityThreshold: input.similarityThreshold,
      },
      "RAG tool search"
    );

    const queryEmbedding = await embedder.embed(input.query);
    const results = await vectorStore.similaritySearch(queryEmbedding, {
      contentTypes: input.contentTypes,
      topK: input.topK,
      similarityThreshold: input.similarityThreshold,
      excludeJiraKeys: [input.excludeJiraKey],
      queryText: input.query,
      useHybrid: true,
    });

    const scored = results
      .map((item) => ({
        jiraKey: item.jiraKey,
        contentType: item.contentType,
        content: compressForTool(item.content, item.contentType),
        similarity: item.similarity ?? 0,
        metadata: item.metadata,
      }))
      .sort((a, b) => b.similarity - a.similarity);

    logger.info(
      {
        resultsFound: scored.length,
        topSimilarity: scored[0]?.similarity ?? 0,
      },
      "RAG tool search complete"
    );

    return {
      results: scored,
      queryUsed: input.query,
      totalFound: scored.length,
    };
  },
};

function compressForTool(content: string, contentType: VectorContentType): string {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (contentType === "prd") {
    const important = lines.filter(
      (line) =>
        line.startsWith("PRD:") ||
        line.startsWith("PROBLEM:") ||
        line.startsWith("SOLUTION:") ||
        line.startsWith("USER STORIES:")
    );
    const criteriaLine = lines.find((line) =>
      line.startsWith("ACCEPTANCE CRITERIA:")
    );
    if (criteriaLine) {
      const trimmed = criteriaLine
        .replace("ACCEPTANCE CRITERIA:", "")
        .trim()
        .split(" | ")
        .slice(0, 3)
        .join(" | ");
      important.push(`ACCEPTANCE CRITERIA: ${trimmed}`);
    }
    return important.join("\n").slice(0, 600);
  }

  if (contentType === "implementation") {
    const important = lines.filter(
      (line) =>
        line.startsWith("IMPLEMENTATION:") ||
        line.startsWith("APPROACH:") ||
        line.startsWith("COMPONENTS:")
    );
    return important.join("\n").slice(0, 500);
  }

  if (contentType === "qa_report") {
    const important = lines.filter(
      (line) =>
        line.startsWith("QA REPORT SUMMARY:") ||
        line.startsWith("RISK AREAS:") ||
        line.startsWith("COVERAGE:")
    );
    return important.join("\n").slice(0, 400);
  }

  if (contentType === "canary_finding") {
    const important = lines.filter(
      (line) =>
        line.startsWith("CANARY FINDING") ||
        line.startsWith("DESCRIPTION:") ||
        line.startsWith("REPRODUCTION:") ||
        line.startsWith("SUGGESTED FIX:")
    );
    return important.join("\n").slice(0, 500);
  }

  return content.slice(0, 400);
}
