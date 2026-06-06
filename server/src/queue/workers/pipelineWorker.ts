import "dotenv/config";
import { Worker } from "bullmq";
import { runMirrorBackfill } from "../../pipeline/jira/mirror/syncService";
import { orchestrator } from "../../pipeline/orchestrator";
import { logger } from "../../utils/logger";
import { JOB_NAMES, redisConnection } from "../jobQueue";
import type { JiraMirrorBackfillJob, PipelineRunJob } from "../../types/pipeline";

type PipelineJobData = PipelineRunJob | JiraMirrorBackfillJob;

export const pipelineWorker = new Worker<PipelineJobData>(
  "agentos-pipeline",
  async (job) => {
    if (job.name === JOB_NAMES.RUN_PIPELINE) {
      const data = job.data as PipelineRunJob;
      logger.info(
        { jobId: job.id, ticketId: data.ticketId },
        "worker job started"
      );
      await orchestrator.run(data.ticketId);
      logger.info(
        { jobId: job.id, ticketId: data.ticketId },
        "worker job completed"
      );
      return;
    }

    if (job.name === JOB_NAMES.RUN_JIRA_MIRROR_BACKFILL) {
      const data = job.data as JiraMirrorBackfillJob;
      logger.info({ jobId: job.id }, "jira mirror backfill started");
      const result = await runMirrorBackfill({
        projectKeys: data.projectKeys,
        maxIssues: data.maxIssues,
      });
      logger.info({ jobId: job.id, result }, "jira mirror backfill completed");
      return;
    }

    throw new Error(`Unknown job ${job.name}`);
  },
  {
    connection: redisConnection,
    concurrency: Number(process.env.PIPELINE_WORKER_CONCURRENCY ?? 2),
  }
);

pipelineWorker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, err }, "worker job failed");
});

pipelineWorker.on("error", (err) => {
  logger.error({ err }, "worker error");
});

if (require.main === module) {
  logger.info("pipeline worker running");
}
