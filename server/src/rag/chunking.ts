import { getEncoding, type Tiktoken } from "js-tiktoken";
import { recordEmbedInputTooLong } from "./embedMetrics";

/** OpenAI embedding models use cl100k_base tokenization. */
const EMBEDDING_ENCODING = "cl100k_base";
const EMBEDDING_MAX_TOKENS = 8191;

let encoding: Tiktoken | null = null;

function getTokenizer(): Tiktoken {
  if (!encoding) {
    encoding = getEncoding(EMBEDDING_ENCODING);
  }
  return encoding;
}

export function countTokens(text: string): number {
  return getTokenizer().encode(text).length;
}

export interface ChunkTextOptions {
  maxTokens?: number;
  overlapTokens?: number;
}

/**
 * Split text on paragraph boundaries with token budget and overlap.
 * Targets ~300–500 tokens per chunk by default (OpenAI RAG guidance).
 */
export function chunkTextByTokens(
  text: string,
  options: ChunkTextOptions = {}
): string[] {
  const maxTokens = options.maxTokens ?? 450;
  const overlapTokens = options.overlapTokens ?? Math.floor(maxTokens * 0.15);
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    const candidate = current ? `${current}\n\n${para}` : para;
    if (countTokens(candidate) > maxTokens && current) {
      chunks.push(current.trim());
      const overlapText = tailTokens(current, overlapTokens);
      current = overlapText ? `${overlapText}\n\n${para}` : para;
    } else {
      current = candidate;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  if (!chunks.length) {
    return [truncateToTokenBudget(normalized, maxTokens)];
  }

  return chunks.map((c) => truncateToTokenBudget(c, maxTokens));
}

function tailTokens(text: string, tokenCount: number): string {
  if (tokenCount <= 0 || !text.trim()) return "";
  const enc = getTokenizer();
  const tokens = enc.encode(text);
  if (tokens.length <= tokenCount) return text;
  return enc.decode(tokens.slice(tokens.length - tokenCount));
}

/** Truncate text to fit embedding model token limit; preserves structure where possible. */
export function truncateToTokenBudget(text: string, maxTokens = EMBEDDING_MAX_TOKENS): string {
  const enc = getTokenizer();
  const tokens = enc.encode(text);
  if (tokens.length <= maxTokens) return text;
  recordEmbedInputTooLong(tokens.length, maxTokens);
  return enc.decode(tokens.slice(0, maxTokens));
}

export function prepareTextForEmbedding(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  return truncateToTokenBudget(normalized);
}

export { EMBEDDING_MAX_TOKENS };
