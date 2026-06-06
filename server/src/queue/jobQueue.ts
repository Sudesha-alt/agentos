import { Queue } from "bullmq";
import IORedis from "ioredis";
import type { CodebaseFullIndexJob, CodebaseIndexJob, PipelineRunJob } from "../types/pipeline";

export const JOB_NAMES = {
  RUN_PIPELINE: "run-pipeline",
  RUN_CODEBASE_INCREMENTAL: "run-codebase-incremental",
  RUN_CODEBASE_FULL: "run-codebase-full",
} as const;

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const jobQueue = new Queue<PipelineRunJob>("agentos-pipeline", {
  connection,
  defaultJobOptions: {
    removeOnComplete: 250,
    removeOnFail: 1000,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  },
});

export const codebaseQueue = new Queue<CodebaseIndexJob | CodebaseFullIndexJob>("agentos-codebase", {
  connection,
  defaultJobOptions: {
    removeOnComplete: 250,
    removeOnFail: 1000,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
  },
});

export { connection as redisConnection };
