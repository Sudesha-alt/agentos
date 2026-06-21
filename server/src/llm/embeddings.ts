import { getOpenAIClient, resetOpenAIClient } from "./openaiClient";
import { withRetry } from "../utils/retry";

export const DEFAULT_EMBEDDING_MODEL = "text-embedding-3-small";
export const DEFAULT_EMBEDDING_DIMENSIONS = 1536;

function isConnectionResetError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  const code =
    err && typeof err === "object" && "code" in err
      ? String((err as { code?: string }).code)
      : "";
  return (
    message.includes("Premature close") ||
    message.includes("ECONNRESET") ||
    message.includes("socket hang up") ||
    code === "ERR_STREAM_PREMATURE_CLOSE"
  );
}

/** Embed one or many texts with backoff; resets the OpenAI client on stream drops. */
export async function createEmbeddingVectors(
  inputs: string[],
  context?: Record<string, unknown>
): Promise<number[][]> {
  if (inputs.length === 0) return [];

  const response = await withRetry(
    () =>
      getOpenAIClient().embeddings.create({
        model: DEFAULT_EMBEDDING_MODEL,
        input: inputs.length === 1 ? inputs[0]! : inputs,
      }),
    {
      maxAttempts: 8,
      baseDelayMs: 4000,
      maxDelayMs: 45_000,
      context: { operation: "embedding", batchSize: inputs.length, ...context },
      onRetry: (err) => {
        if (isConnectionResetError(err)) {
          resetOpenAIClient();
        }
      },
    }
  );

  return [...response.data]
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}
