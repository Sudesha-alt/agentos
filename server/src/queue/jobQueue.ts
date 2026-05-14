import { Queue } from "bullmq";
import IORedis from "ioredis";
import type { PipelineRunJob } from "../types/pipeline";

export const JOB_NAMES = {
  RUN_PIPELINE: "run-pipeline",
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

export { connection as redisConnection };
