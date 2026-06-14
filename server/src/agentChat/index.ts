import { runAnantaChatTurn } from "./anantaChatService";
import { runQaChatTurn } from "./qaChatService";
import type { AgentChatDomain, AgentChatTurnResult } from "./types";
import { runVirinChatTurn } from "./virinChatService";

export async function runDomainChatTurn(input: {
  domain: AgentChatDomain;
  threadId: string;
  contextKey: string;
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  userMessage: string;
}): Promise<AgentChatTurnResult> {
  switch (input.domain) {
    case "virin":
      return runVirinChatTurn(input);
    case "ananta":
      return runAnantaChatTurn(input);
    case "neel":
      return runQaChatTurn(input);
    default:
      throw new Error(`Unknown agent chat domain: ${input.domain}`);
  }
}
