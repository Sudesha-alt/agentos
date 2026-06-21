import type { ImplementationOutput } from "../types/agents";
import { BaseAgent } from "./baseAgent";
import { buildEngineeringAgentSystemPrompt } from "./engineeringAgentPrompt";

export class EngineeringAgent extends BaseAgent<ImplementationOutput> {
  name = "ENGINEERING_AGENT";

  systemPrompt = buildEngineeringAgentSystemPrompt("code");

  parseOutput(raw: string): ImplementationOutput {
    return this.safeJsonParse(raw) as ImplementationOutput;
  }
}
