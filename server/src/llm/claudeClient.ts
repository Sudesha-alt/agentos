import Anthropic from "@anthropic-ai/sdk";
import { AnthropicBedrock } from "@anthropic-ai/bedrock-sdk";

export type ClaudeClient = Anthropic | AnthropicBedrock;

let cached: ClaudeClient | undefined;

function llmProvider(): "anthropic" | "bedrock" {
  const value = (process.env.LLM_PROVIDER ?? "anthropic").toLowerCase();
  if (value === "bedrock") return "bedrock";
  if (value === "anthropic") return "anthropic";
  throw new Error(`Invalid LLM_PROVIDER "${value}". Use "anthropic" or "bedrock".`);
}

/** Shared Claude client for direct API or AWS Bedrock (same messages API). */
export function getClaudeClient(): ClaudeClient {
  if (cached) return cached;

  if (llmProvider() === "bedrock") {
    cached = new AnthropicBedrock({
      awsRegion: process.env.AWS_REGION ?? "us-east-1",
    });
    return cached;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic");
  }

  cached = new Anthropic({ apiKey });
  return cached;
}

/** Model id for the active provider (Bedrock uses anthropic.* inference profile ids). */
export function getClaudeModel(): string {
  if (llmProvider() === "bedrock") {
    return (
      process.env.BEDROCK_MODEL_ID ??
      "anthropic.claude-sonnet-4-20250514-v1:0"
    );
  }
  return process.env.ANTHROPIC_MODEL_ID ?? "claude-sonnet-4-20250514";
}
