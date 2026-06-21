import { logger } from "../utils/logger";

const counters = {
  embedTruncated: 0,
  embedChunksDropped: 0,
  embedInputTooLong: 0,
};

export function recordEmbedTruncation(reason: "input" | "chunks"): void {
  if (reason === "input") counters.embedTruncated += 1;
  else counters.embedChunksDropped += 1;
  logger.warn({ metric: reason === "input" ? "embed_truncated" : "embed_chunks_dropped" }, "embedding truncation");
}

export function recordEmbedInputTooLong(originalTokens: number, maxTokens: number): void {
  counters.embedInputTooLong += 1;
  logger.warn(
    { metric: "embed_input_too_long", originalTokens, maxTokens },
    "embedding input exceeded token budget"
  );
}

export function getEmbedMetrics(): Readonly<typeof counters> {
  return { ...counters };
}

export function resetEmbedMetrics(): void {
  counters.embedTruncated = 0;
  counters.embedChunksDropped = 0;
  counters.embedInputTooLong = 0;
}
