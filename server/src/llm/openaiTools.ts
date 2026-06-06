import type Anthropic from "@anthropic-ai/sdk";
import type { ChatCompletionTool } from "openai/resources/chat/completions";

export function anthropicToolsToOpenAI(tools: Anthropic.Tool[]): ChatCompletionTool[] {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description ?? "",
      parameters: tool.input_schema as Record<string, unknown>,
    },
  }));
}
