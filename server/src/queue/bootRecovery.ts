import { prisma } from "../db/client";
import { auditRepo } from "../db/repositories/auditRepo";
import { logger } from "../utils/logger";
import {
  resetStaleActiveItems,
  listOrganizationIdsWithPendingQueue,
} from "./pipelineQueueStore";

const STALE_RUNNING_MS = Number(
  process.env.PIPELINE_STALE_RUNNING_MS ?? 6 * 60 * 60 * 1000
);

export async function recoverPipelineStateOnBoot(): Promise<void> {
  const reset = await resetStaleActiveItems();
  if (reset > 0) {
    logger.warn(
      { count: reset },
      "reset stale ACTIVE queue items to PENDING after restart"
    );
  }

  const staleCutoff = new Date(Date.now() - STALE_RUNNING_MS);
  const staleRunning = await prisma.pipeline.findMany({
    where: {
      status: "RUNNING",
      startedAt: { lt: staleCutoff },
    },
    select: { id: true, currentStage: true },
  });

  if (staleRunning.length > 0) {
    const staleHours = Math.round(STALE_RUNNING_MS / 3_600_000);
    for (const pipeline of staleRunning) {
      await auditRepo.log(pipeline.id, "PIPELINE_FAILED", {
        stage: pipeline.currentStage,
        error: `Pipeline timed out after ${staleHours} hours without completing.`,
        reason: "stale_running_timeout",
      });
    }

    await prisma.pipeline.updateMany({
      where: { id: { in: staleRunning.map((p) => p.id) } },
      data: { status: "FAILED", completedAt: new Date() },
    });
    logger.warn(
      { count: staleRunning.length, staleCutoffMs: STALE_RUNNING_MS },
      "marked stale RUNNING pipelines as FAILED on boot"
    );
  }

  const orgIds = await listOrganizationIdsWithPendingQueue();
  if (orgIds.length > 0) {
    logger.info({ orgCount: orgIds.length }, "queue items pending recovery on boot");
  }
}

export async function listBootRecoveryOrganizationIds(): Promise<string[]> {
  return listOrganizationIdsWithPendingQueue();
}
