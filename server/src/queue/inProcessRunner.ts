import { orchestrator } from "../pipeline/orchestrator";
import { logger } from "../utils/logger";

const runningPipelines = new Set<string>();

/** Fire-and-forget pipeline run on the API process event loop. */
export function runPipelineInBackground(ticketId: string): { started: boolean } {
  if (runningPipelines.has(ticketId)) {
    logger.warn({ ticketId }, "pipeline already running in-process");
    return { started: false };
  }

  runningPipelines.add(ticketId);
  void orchestrator
    .run(ticketId)
    .catch((err) => {
      logger.error({ err, ticketId }, "in-process pipeline failed");
    })
    .finally(() => {
      runningPipelines.delete(ticketId);
    });

  return { started: true };
}
