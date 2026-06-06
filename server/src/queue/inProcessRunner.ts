import { runMirrorBackfill } from "../pipeline/jira/mirror/syncService";
import { orchestrator } from "../pipeline/orchestrator";
import { logger } from "../utils/logger";

const runningPipelines = new Set<string>();
let mirrorBackfillRunning = false;

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

/** Fire-and-forget Jira mirror backfill on the API process event loop. */
export function runMirrorBackfillInBackground(options: {
  projectKeys?: string[];
  maxIssues?: number;
}): { started: boolean } {
  if (mirrorBackfillRunning) {
    logger.warn("jira mirror backfill already running in-process");
    return { started: false };
  }

  mirrorBackfillRunning = true;
  void runMirrorBackfill(options)
    .catch((err) => {
      logger.error({ err }, "in-process jira mirror backfill failed");
    })
    .finally(() => {
      mirrorBackfillRunning = false;
    });

  return { started: true };
}
