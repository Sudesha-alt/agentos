export type AgentChatDomain = "virin" | "ananta" | "neel";

export interface AgentChatMessageDto {
  id: string;
  role: "user" | "assistant";
  content: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface AgentChatThreadDto {
  id: string;
  agentDomain: AgentChatDomain;
  contextKey: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  messages?: AgentChatMessageDto[];
}

export interface AgentChatTurnResult {
  assistantMessage: AgentChatMessageDto;
  toolCallLog: Array<{ tool: string; query: string; resultsFound: number }>;
  costUsd: number;
}
