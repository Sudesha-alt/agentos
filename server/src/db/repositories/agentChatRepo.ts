import type { Prisma } from "../prisma";
import { prisma } from "../client";
import type {
  AgentChatDomain,
  AgentChatMessageDto,
  AgentChatThreadDto,
} from "../../agentChat/types";

function toMessageDto(row: {
  id: string;
  role: string;
  content: string;
  metadata: unknown;
  createdAt: Date;
}): AgentChatMessageDto {
  return {
    id: row.id,
    role: row.role as "user" | "assistant",
    content: row.content,
    metadata:
      row.metadata && typeof row.metadata === "object"
        ? (row.metadata as Record<string, unknown>)
        : null,
    createdAt: row.createdAt.toISOString(),
  };
}

function toThreadDto(row: {
  id: string;
  agentDomain: string;
  contextKey: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
  messages?: Array<{
    id: string;
    role: string;
    content: string;
    metadata: unknown;
    createdAt: Date;
  }>;
}): AgentChatThreadDto {
  return {
    id: row.id,
    agentDomain: row.agentDomain as AgentChatDomain,
    contextKey: row.contextKey,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    messages: row.messages?.map(toMessageDto),
  };
}

export const agentChatRepo = {
  async findThread(
    agentDomain: AgentChatDomain,
    contextKey: string
  ): Promise<AgentChatThreadDto | null> {
    const row = await prisma.agentChatThread.findUnique({
      where: { agentDomain_contextKey: { agentDomain, contextKey } },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
    return row ? toThreadDto(row) : null;
  },

  async getOrCreateThread(input: {
    agentDomain: AgentChatDomain;
    contextKey?: string;
    title?: string;
  }): Promise<AgentChatThreadDto> {
    const contextKey = input.contextKey ?? "";
    const existing = await prisma.agentChatThread.findUnique({
      where: { agentDomain_contextKey: { agentDomain: input.agentDomain, contextKey } },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (existing) return toThreadDto(existing);

    const created = await prisma.agentChatThread.create({
      data: {
        agentDomain: input.agentDomain,
        contextKey,
        title: input.title ?? null,
      },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    return toThreadDto(created);
  },

  async getThreadById(threadId: string): Promise<AgentChatThreadDto | null> {
    const row = await prisma.agentChatThread.findUnique({
      where: { id: threadId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    return row ? toThreadDto(row) : null;
  },

  async listMessages(threadId: string): Promise<AgentChatMessageDto[]> {
    const rows = await prisma.agentChatMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toMessageDto);
  },

  async appendMessage(input: {
    threadId: string;
    role: "user" | "assistant";
    content: string;
    metadata?: Record<string, unknown>;
  }): Promise<AgentChatMessageDto> {
    const row = await prisma.agentChatMessage.create({
      data: {
        threadId: input.threadId,
        role: input.role,
        content: input.content,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
    await prisma.agentChatThread.update({
      where: { id: input.threadId },
      data: {
        updatedAt: new Date(),
        ...(input.role === "user" && !input.metadata?.skipTitle
          ? {}
          : {}),
      },
    });
    return toMessageDto(row);
  },

  async updateThreadTitle(threadId: string, title: string): Promise<void> {
    await prisma.agentChatThread.update({
      where: { id: threadId },
      data: { title },
    });
  },

  async deleteThread(threadId: string): Promise<void> {
    await prisma.agentChatThread.delete({ where: { id: threadId } });
  },
};
