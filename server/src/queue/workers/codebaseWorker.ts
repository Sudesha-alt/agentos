import "dotenv/config";
import { Worker } from "bullmq";
import { runIncrementalIndex } from "../../codebaseIntelligence/indexer";
import type { CodebaseIndexJob } from "../../types/pipeline";
import { logger } from "../../utils/logger";
import { JOB_NAMES, redisConnection } from "../jobQueue";

export const codebaseWorker = new Worker<CodebaseIndexJob>(
  "agentos-codebase",
  async (job) => {
    if (job.name !== JOB_NAMES.RUN_CODEBASE_INCREMENTAL) {
      throw new Error(`Unknown codebase job ${job.name}`);
    }
    logger.info({ jobId: job.id, branch: job.data.branchName }, "codebase worker started");
    await runIncrementalIndex(job.data);
    logger.info({ jobId: job.id, branch: job.data.branchName }, "codebase worker completed");
  },
  { connection: redisConnection, concurrency: 1 }
);

codebaseWorker.on("failed", (job, err) => {
  logger.error({ jobId: job?.id, err }, "codebase worker job failed");
});
