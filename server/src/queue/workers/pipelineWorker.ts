import "dotenv/config";
import { Worker } from "bullmq";
import { orchestrator } from "../../pipeline/orchestrator";
import { logger } from "../../utils/logger";
import { JOB_NAMES, redisConnection } from "../jobQueue";
import type { PipelineRunJob } from "../../types/pipeline";

export const pipelineWorker = new Worker<PipelineRunJob>(
  "agentos-pipeline",
  async (job) => {
    if (job.name !== JOB_NAMES.RUN_PIPELINE) {
      throw new Error(`Unknown job ${job.name}`);
    }

    logger.info(
      { jobId: job.id, ticketId: job.data.ticketId },
      "worker job started"
    );
    await orchestrator.run(job.data.ticketId);
    logger.info(
      { jobId: job.id, ticketId: job.data.ticketId },
      "worker job completed"
    );
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
