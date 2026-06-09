import { getTechAgentHandoff } from "../pm/handoff";

export type TechAgentRunStatus = "ready" | "not_implemented";

export interface TechAgentRunResult {
  handoff: Awaited<ReturnType<typeof getTechAgentHandoff>>["handoff"];
  prompt: string;
  codeSnapshots: Awaited<ReturnType<typeof getTechAgentHandoff>>["codeSnapshots"];
  status: TechAgentRunStatus;
  message: string;
}

/**
 * Prepares a Tech Agent handoff from completed PM pipeline output.
 * Future: invoke Cursor SDK or engineering agent with the assembled prompt.
 */
export async function prepareTechAgentHandoff(
  ticketId: string
): Promise<TechAgentRunResult> {
  const { handoff, prompt, codeSnapshots } = await getTechAgentHandoff(ticketId);
  return {
    handoff,
    prompt,
    codeSnapshots,
    status: "ready",
    message:
      "Handoff prompt assembled. Copy the prompt or wire Cursor SDK to start implementation.",
  };
}

/** Stub entry point for a future automated tech agent run. */
export async function runTechAgent(ticketId: string): Promise<TechAgentRunResult> {
  return prepareTechAgentHandoff(ticketId);
}
