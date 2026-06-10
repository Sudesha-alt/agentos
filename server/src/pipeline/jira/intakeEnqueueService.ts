import type { Prisma } from "../../db/prisma";
import { getPipelineJiraClient } from "./client";
import {
  normalizePipelineIssue,
  type PipelineJiraIssue,
} from "./ticketNormalizer";
import { decomposeForPipelineIntake } from "./taskDecomposer";
import { ticketRepo } from "../../db/repositories/ticketRepo";
import {
  enqueuePipelineBatch,
  isJiraKeyInPipelineQueue,
} from "../../queue/inProcessRunner";
import { shouldEnqueueJiraKey, logIntakeSkipped } from "./intakeDedup";
import { classifyAiWorkerIntake } from "../../integrations/intentClassifier";
import { logger } from "../../utils/logger";
import type { PmPipelineContext } from "../../agents/pm/pmPipelineContext";
import type { PipelineJiraWebhookPayload } from "./ticketNormalizer";

const FETCH_FIELDS = [
  "summary",
  "description",
  "issuetype",
  "priority",
  "reporter",
  "assignee",
  "labels",
  "customfield_10014",
  "customfield_10016",
  "components",
  "created",
  "project",
];

export interface IntakeEnqueueResult {
  sourceKey: string;
  enqueued: number;
  skipped: number;
  started: boolean;
  groups: Array<{ storyKey: string; taskKeys: string[] }>;
}

export async function enqueueIntakeFromWebhook(
  payload: PipelineJiraWebhookPayload
): Promise<IntakeEnqueueResult | null> {
  const normalized = normalizePipelineIssue(payload.issue);
  const intent = classifyAiWorkerIntake(normalized);

  if (!intent.requiresPipeline) {
    logger.info(
      { jiraKey: normalized.jiraKey, reason: intent.skipReason },
      "pipeline intake skipped"
    );
    return null;
  }

  return enqueueIntakeFromJiraKey(normalized.jiraKey, payload);
}

export async function enqueueIntakeFromJiraKey(
  jiraKey: string,
  rawPayload?: PipelineJiraWebhookPayload,
  pmContext?: PmPipelineContext
): Promise<IntakeEnqueueResult> {
  const decomposed = await decomposeForPipelineIntake(jiraKey);
  const batchItems: Array<{ ticketId: string; jiraKey: string }> = [];
  let skipped = 0;

  logger.info(
    {
      sourceKey: decomposed.sourceKey,
      sourceIssueType: decomposed.sourceIssueType,
      storyGroups: decomposed.groups.length,
      totalTasks: decomposed.groups.reduce((n, g) => n + g.taskKeys.length, 0),
    },
    "decomposed AI Worker intake"
  );

  for (const group of decomposed.groups) {
    for (const taskKey of group.taskKeys) {
      if (isJiraKeyInPipelineQueue(taskKey)) {
        skipped += 1;
        logger.info({ taskKey, storyKey: group.storyKey }, "task already active or queued");
        continue;
      }

      const dedup = await shouldEnqueueJiraKey(taskKey);
      if (!dedup.enqueue) {
        skipped += 1;
        await logIntakeSkipped(taskKey, dedup.reason!, dedup.message ?? dedup.reason!, "manual");
        continue;
      }

      const issue = await fetchPipelineIssue(taskKey);
      const normalized = normalizePipelineIssue(issue);
      const taskIntent = classifyAiWorkerIntake(normalized);

      if (!taskIntent.requiresPipeline) {
        skipped += 1;
        logger.info(
          { jiraKey: taskKey, reason: taskIntent.skipReason },
          "decomposed task skipped"
        );
        continue;
      }

      const enrichedNormalized = {
        ...normalized,
        createdAt: normalized.createdAt.toISOString(),
        intakeSourceKey: decomposed.sourceKey,
        parentStoryKey: group.storyKey,
        ...(pmContext && taskKey === pmContext.jiraKey ? { pmContext } : {}),
      };

      const ticket = await ticketRepo.create({
        jiraTicketId: normalized.jiraTicketId,
        jiraKey: normalized.jiraKey,
        rawPayload: (rawPayload ?? issue) as unknown as Prisma.InputJsonValue,
        normalizedData: enrichedNormalized as unknown as Prisma.InputJsonValue,
        status: "RECEIVED",
      });

      batchItems.push({ ticketId: ticket.id, jiraKey: normalized.jiraKey });
    }
  }

  const batchResult =
    batchItems.length > 0 ? enqueuePipelineBatch(batchItems) : { started: false, enqueued: 0 };

  return {
    sourceKey: decomposed.sourceKey,
    enqueued: batchResult.enqueued,
    skipped,
    started: batchResult.started,
    groups: decomposed.groups.map((g) => ({
      storyKey: g.storyKey,
      taskKeys: g.taskKeys,
    })),
  };
}

async function fetchPipelineIssue(jiraKey: string): Promise<PipelineJiraIssue> {
  const client = getPipelineJiraClient();
  return (await client.getIssueWithFields<PipelineJiraIssue>(
    jiraKey,
    FETCH_FIELDS
  )) as PipelineJiraIssue;
}
