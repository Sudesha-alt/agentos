import type { PipelineStage } from "../db/prisma";
import { prisma } from "../db/client";
import { auditRepo } from "../db/repositories/auditRepo";
import { pipelineRepo } from "../db/repositories/pipelineRepo";
import { syncEngineeringHandoffFromPipelineState } from "../agents/pm/handoffStatus";

// Allowed forward transitions. Failures and human overrides can also move
// the pipeline backwards or to terminal states — those are explicit calls.
const TRANSITIONS: Record<PipelineStage, PipelineStage[]> = {
  INGESTION: ["PRODUCT_AGENT"],
  PRODUCT_AGENT: ["PRD_VALIDATION"],
  PRD_VALIDATION: ["ENGINEERING_AGENT"],
  ENGINEERING_AGENT: ["IMPLEMENTATION_VALIDATION"],
  IMPLEMENTATION_VALIDATION: ["QA_AGENT"],
  QA_AGENT: ["QA_VALIDATION"],
  QA_VALIDATION: ["OUTPUT"],
  OUTPUT: [],
};

export const stateManager = {
  canTransition(from: PipelineStage, to: PipelineStage): boolean {
    return TRANSITIONS[from]?.includes(to) ?? false;
  },

  async advance(
    pipelineId: string,
    nextStage: PipelineStage
  ): Promise<void> {
    const pipeline = await prisma.pipeline.findUnique({
      where: { id: pipelineId },
    });
    if (!pipeline) throw new Error(`Pipeline ${pipelineId} not found`);

    if (!stateManager.canTransition(pipeline.currentStage, nextStage)) {
      throw new Error(
        `Illegal transition ${pipeline.currentStage} -> ${nextStage}`
      );
    }

    await pipelineRepo.setStage(pipelineId, nextStage, "RUNNING");
    await auditRepo.log(pipelineId, "STAGE_ADVANCED", {
      from: pipeline.currentStage,
      to: nextStage,
    });
    if (nextStage === "ENGINEERING_AGENT") {
      void syncEngineeringHandoffFromPipelineState(pipelineId).catch(() => undefined);
    }
  },

  async pauseForHuman(
    pipelineId: string,
    stage: PipelineStage,
    reason: string
  ): Promise<void> {
    await prisma.pipeline.update({
      where: { id: pipelineId },
      data: { currentStage: stage, status: "PAUSED" },
    });
    await auditRepo.log(pipelineId, "AWAITING_HUMAN", { stage, reason });
  },

  async fail(
    pipelineId: string,
    stage: PipelineStage,
    error: string
  ): Promise<void> {
    await prisma.pipeline.update({
      where: { id: pipelineId },
      data: { currentStage: stage, status: "FAILED", completedAt: new Date() },
    });
    await auditRepo.log(pipelineId, "PIPELINE_FAILED", { stage, error });
    void syncEngineeringHandoffFromPipelineState(pipelineId).catch(() => undefined);
  },

  async complete(pipelineId: string): Promise<void> {
    await pipelineRepo.complete(pipelineId, "COMPLETED");
    await auditRepo.log(pipelineId, "PIPELINE_COMPLETED", {});
    void syncEngineeringHandoffFromPipelineState(pipelineId).catch(() => undefined);
  },
};
