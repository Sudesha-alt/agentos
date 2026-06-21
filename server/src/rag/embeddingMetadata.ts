import {
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_EMBEDDING_DIMENSIONS,
} from "../llm/embeddings";

/** Standard metadata stored on every embedded vector row. */
export function buildEmbeddingMetadata(
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    embeddingModel: DEFAULT_EMBEDDING_MODEL,
    embeddingDims: DEFAULT_EMBEDDING_DIMENSIONS,
    embeddedAt: new Date().toISOString(),
    ...extra,
  };
}
