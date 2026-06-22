import type { ImplementationOutput } from "../types/agents";
import { parseDiscoveryJson } from "../llm/discoveryCompletion";
import { BaseAgent } from "./baseAgent";
import { buildEngineeringAgentSystemPrompt } from "./engineeringAgentPrompt";

export class EngineeringAgent extends BaseAgent<ImplementationOutput> {
  name = "ENGINEERING_AGENT";

  systemPrompt = buildEngineeringAgentSystemPrompt("code");
  protected maxTokens = 8000;

  parseOutput(raw: string): ImplementationOutput {
    return parseDiscoveryJson<ImplementationOutput>(raw, this.name);
  }
}
