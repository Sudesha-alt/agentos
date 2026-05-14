import type { Prisma } from "@prisma/client";
import { prisma } from "../client";

export const auditRepo = {
  /**
   * Append-only audit log. Every state transition, agent call, validation
   * decision, override, and webhook event is recorded here.
   */
  async log(
    pipelineId: string,
    event: string,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    await prisma.auditLog.create({
      data: {
        pipelineId,
        event,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  },

  async listForPipeline(pipelineId: string, limit = 200) {
    return prisma.auditLog.findMany({
      where: { pipelineId },
      orderBy: { timestamp: "desc" },
      take: limit,
    });
  },
};
