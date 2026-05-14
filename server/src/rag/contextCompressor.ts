import type { CompressedContext, RetrievedContext } from "../types/pipeline";

const DEFAULT_MAX_TOKENS = 3000;
const DEFAULT_MAX_CHUNK_CHARS = 900;

export interface CompressionInput {
  currentLabel: string;
  currentBody: string;
  retrievedContext: RetrievedContext[];
  maxTokens?: number;
}

// Converts raw retrieved chunks into a prompt-safe context block that keeps the
// highest-value institutional memory and drops the rest.
export const contextCompressor = {
  compress(input: CompressionInput): CompressedContext {
    const maxTokens = input.maxTokens ?? DEFAULT_MAX_TOKENS;
    const sections: string[] = [
      `${input.currentLabel.toUpperCase()}:\n${input.currentBody}`.trim(),
    ];

    let tokenEstimate = estimateTokens(sections[0]);
    let chunksUsed = 0;
    let droppedChunks = 0;

    const ranked = rankAndDedupe(input.retrievedContext);

    if (ranked.length > 0) {
      sections.push("RELEVANT HISTORICAL CONTEXT:");
      tokenEstimate = estimateTokens(sections.join("\n\n"));
    }

    for (const ctx of ranked) {
      const remainingTokens = maxTokens - tokenEstimate;
      if (remainingTokens <= 100) {
        droppedChunks += 1;
        continue;
      }

      const chunk = formatContextChunk(ctx, remainingTokens);
      const chunkTokens = estimateTokens(chunk);

      if (tokenEstimate + chunkTokens > maxTokens) {
        droppedChunks += 1;
        continue;
      }

      sections.push(chunk);
      tokenEstimate += chunkTokens;
      chunksUsed += 1;
    }

    return {
      text: sections.join("\n\n"),
      tokenEstimate,
      chunksUsed,
      droppedChunks,
    };
  },
};

function rankAndDedupe(items: RetrievedContext[]): RetrievedContext[] {
  const seen = new Set<string>();

  return items
    .map((item) => ({
      ...item,
      similarity: Math.min(1, scoreContext(item)),
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .filter((item) => {
      const key = `${item.jiraKey}:${item.contentType}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function scoreContext(item: RetrievedContext): number {
  let score = item.similarity;

  if (item.contentType === "prd") score += 0.03;
  if (item.contentType === "implementation") score += 0.02;

  const metadata = item.metadata;
  const criteriaCount =
    typeof metadata.criteriaCount === "number" ? metadata.criteriaCount : 0;
  const testCaseCount =
    typeof metadata.testCaseCount === "number" ? metadata.testCaseCount : 0;

  if (criteriaCount >= 5) score += 0.01;
  if (testCaseCount >= 5) score += 0.01;

  return score;
}

function formatContextChunk(
  ctx: RetrievedContext,
  remainingTokens: number
): string {
  const maxChars = Math.min(DEFAULT_MAX_CHUNK_CHARS, remainingTokens * 4);
  const excerpt = smartTrim(ctx.content, maxChars);

  return `[${ctx.contentType.toUpperCase()} — ${ctx.jiraKey} — Similarity: ${(
    ctx.similarity * 100
  ).toFixed(0)}%]
${excerpt}`.trim();
}

function smartTrim(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const lastBoundary = Math.max(
    slice.lastIndexOf(". "),
    slice.lastIndexOf(" | "),
    slice.lastIndexOf("\n"),
    slice.lastIndexOf(" ")
  );
  if (lastBoundary > maxChars * 0.55) {
    return `${slice.slice(0, lastBoundary).trim()}...`;
  }
  return `${slice.trim()}...`;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
