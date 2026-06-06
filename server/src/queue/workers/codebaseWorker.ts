import "dotenv/config";
import { Worker } from "bullmq";
import { runFullIndex, runIncrementalIndex } from "../../codebaseIntelligence/indexer";
import type { CodebaseFullIndexJob, CodebaseIndexJob } from "../../types/pipeline";
import { logger } from "../../utils/logger";
import { JOB_NAMES, redisConnection } from "../jobQueue";

export const codebaseWorker = new Worker<
  CodebaseIndexJob | CodebaseFullIndexJob
>(
  "agentos-codebase",
  async (job) => {
    if (job.name === JOB_NAMES.RUN_CODEBASE_INCREMENTAL) {
      const data = job.data as CodebaseIndexJob;
      logger.info({ jobId: job.id, branch: data.branchName }, "codebase incremental worker started");
      await runIncrementalIndex(data);
      logger.info({ jobId: job.id, branch: data.branchName }, "codebase incremental worker completed");
      return;
    }

    if (job.name === JOB_NAMES.RUN_CODEBASE_FULL) {
      const data = job.data as CodebaseFullIndexJob;
      logger.info({ jobId: job.id, branch: data.branchName, runId: data.runId }, "codebase full worker started");
      await runFullIndex(data.branchName, {
        runId: data.runId,
        triggerType: data.triggerType,
      });
      logger.info({ jobId: job.id, branch: data.branchName, runId: data.runId }, "codebase full worker completed");
      return;
    }

    throw new Error(`Unknown codebase job ${job.name}`);
  },
  { connection: redisConnection, concurrency: 1 }
);

codebaseWorker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, err }, "codebase worker job failed");
});
