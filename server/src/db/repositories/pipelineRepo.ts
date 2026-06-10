import type {
  Pipeline,
  PipelineStage,
  PipelineStageLog,
  PipelineStatus,
  Prisma,
  StageStatus,
} from "../prisma";
import { prisma } from "../client";

export const pipelineRepo = {
  async create(input: {
    ticketId: string;
    currentStage: PipelineStage;
    status: PipelineStatus;
  }): Promise<Pipeline> {
    return prisma.pipeline.upsert({
      where: { ticketId: input.ticketId },
      update: { currentStage: input.currentStage, status: input.status },
      create: input,
    });
  },

  async setStage(
    pipelineId: string,
    stage: PipelineStage,
    status: PipelineStatus
  ): Promise<void> {
    await prisma.pipeline.update({
      where: { id: pipelineId },
      data: { currentStage: stage, status },
    });
  },

  async complete(pipelineId: string, status: PipelineStatus): Promise<void> {
    await prisma.pipeline.update({
      where: { id: pipelineId },
      data: { status, completedAt: new Date() },
    });
  },

  async findWithLatestStages(pipelineId: string) {
    return prisma.pipeline.findUnique({
      where: { id: pipelineId },
      include: {
        ticket: true,
        stages: { orderBy: { startedAt: "desc" } },
        overrides: { orderBy: { overriddenAt: "desc" } },
        auditLogs: { orderBy: { timestamp: "desc" }, take: 50 },
      },
    });
  },

  async startStage(input: {
    pipelineId: string;
    stage: PipelineStage;
    inputJson: Prisma.InputJsonValue;
    status?: StageStatus;
  }): Promise<PipelineStageLog> {
    return prisma.pipelineStageLog.create({
      data: {
        pipelineId: input.pipelineId,
        stage: input.stage,
        status: input.status ?? "RUNNING",
        input: input.inputJson,
      },
    });
  },

  async completeStage(input: {
    stageLogId: string;
    output: Prisma.InputJsonValue;
    validationResult?: Prisma.InputJsonValue;
    confidenceScore?: number;
    tokenCount?: number;
    costUsd?: number;
    status?: StageStatus;
  }): Promise<void> {
    await prisma.pipelineStageLog.update({
      where: { id: input.stageLogId },
      data: {
        status: input.status ?? "COMPLETED",
        output: input.output,
        validationResult: input.validationResult,
        confidenceScore: input.confidenceScore,
        tokenCount: input.tokenCount,
        costUsd: input.costUsd,
        completedAt: new Date(),
      },
    });
  },

  async failStage(stageLogId: string, error: string): Promise<void> {
    await prisma.pipelineStageLog.update({
      where: { id: stageLogId },
      data: {
        status: "FAILED",
        error,
        completedAt: new Date(),
      },
    });
  },

  async getStageOutput(
    pipelineId: string,
    stage: PipelineStage
  ): Promise<PipelineStageLog | null> {
    return prisma.pipelineStageLog.findFirst({
      where: { pipelineId, stage, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
    });
  },

  async findById(pipelineId: string) {
    return prisma.pipeline.findUnique({
      where: { id: pipelineId },
      include: { ticket: true },
    });
  },

  async listCompletedStages(pipelineId: string): Promise<PipelineStage[]> {
    const logs = await prisma.pipelineStageLog.findMany({
      where: { pipelineId, status: "COMPLETED" },
      select: { stage: true },
    });
    return [...new Set(logs.map((l) => l.stage))];
  },

  async recordOverride(input: {
    pipelineId: string;
    stage: PipelineStage;
    originalOutput: Prisma.InputJsonValue;
    correctedOutput: Prisma.InputJsonValue;
    overriddenBy: string;
    reason?: string;
  }) {
    return prisma.humanOverride.create({ data: input });
  },
};
