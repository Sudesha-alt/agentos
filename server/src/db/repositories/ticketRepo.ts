import type { Prisma, TicketStatus, Ticket } from "@prisma/client";
import { prisma } from "../client";

export const ticketRepo = {
  async create(input: {
    jiraTicketId: string;
    jiraKey: string;
    rawPayload: Prisma.InputJsonValue;
    normalizedData: Prisma.InputJsonValue;
    status: TicketStatus;
  }): Promise<Ticket> {
    return prisma.ticket.upsert({
      where: { jiraTicketId: input.jiraTicketId },
      update: {
        rawPayload: input.rawPayload,
        normalizedData: input.normalizedData,
        status: input.status,
      },
      create: input,
    });
  },

  async findById(id: string): Promise<Ticket | null> {
    return prisma.ticket.findUnique({ where: { id } });
  },

  async findByJiraKey(jiraKey: string): Promise<Ticket | null> {
    return prisma.ticket.findFirst({ where: { jiraKey } });
  },

  async setStatus(id: string, status: TicketStatus): Promise<void> {
    await prisma.ticket.update({ where: { id }, data: { status } });
  },
};
