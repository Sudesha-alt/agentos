import OpenAI from "openai";

let cached: OpenAI | undefined;

/** Lazy OpenAI client — server boot must not require OPENAI_API_KEY. */
export function getOpenAIClient(): OpenAI {
  if (cached) return cached;

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is required for embedding and semantic codebase search"
    );
  }

  cached = new OpenAI({ apiKey });
  return cached;
}
