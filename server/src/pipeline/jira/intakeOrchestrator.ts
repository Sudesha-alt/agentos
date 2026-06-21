import type { Prisma } from "../../db/prisma";
import { getPipelineJiraClient } from "./client";
import {
  normalizePipelineIssue,
  type PipelineJiraIssue,
  type PipelineJiraWebhookPayload,
} from "./ticketNormalizer";
import { decomposeForPipelineIntake, decomposeFromPipelineIssue } from "./taskDecomposer";
import { ticketRepo } from "../../db/repositories/ticketRepo";
import {
  enqueuePipelineBatch,
  isJiraKeyInPipelineQueue,
} from "../../queue/inProcessRunner";
import { isPipelineIntakeStatus } from "./intakeConfig";
import {
  formatIntakeStatusSkipMessage,
  getAiWorkerIntakeStatusesLive,
  getLiveAiWorkerColumnStatuses,
  isIssueInAiWorkerIntake,
} from "./intakeStatusResolver";
import { shouldEnqueueJiraKey } from "./intakeDedup";
import { classifyAiWorkerIntake } from "../../integrations/intentClassifier";
import { getActiveOrganizationId } from "../../organization/context";
import { logger } from "../../utils/logger";
import type { PmPipelineContext } from "../../agents/pm/pmPipelineContext";
import { runPmAnalysisPipeline } from "../../agents/pm/orchestrator";
import { startPmAnalysisInBackground, isPmAnalysisRunning } from "../../agents/pm/backgroundRunner";
import { pmAnalysisStore } from "../../agents/pm/store";
import { JIRA_ISSUE_FETCH_FIELDS, mapJiraApiIssue } from "../../jira-sync/issueFetcher";
import { upsertJiraIssueRecord } from "../../jira-sync/issueRepository";
import { aiWorkerEligibleTypeLabel } from "./aiWorkerIssueTypes";
import {
  recordIntakeEvent,
  type IntakeEventSource,
} from "../../db/repositories/intakeEventRepo";
import type { IntakeSkipReason } from "./intakeDedup";

export interface IntakeEnqueueResult {
  sourceKey: string;
  enqueued: number;
  skipped: number;
  started: boolean;
  groups: Array<{ storyKey: string; taskKeys: string[] }>;
}

function normalizeSource(
  source: IntakeEventSource | "manual"
): IntakeEventSource {
  return source;
}

async function recordSkip(
  jiraKey: string,
  source: IntakeEventSource | "manual",
  skipReason: IntakeSkipReason | string,
  message: string,
  extra?: { summary?: string; issueType?: string }
): Promise<void> {
  const organizationId = getActiveOrganizationId();
  if (!organizationId) return;
  await recordIntakeEvent({
    organizationId,
    jiraKey,
    source: normalizeSource(source),
    outcome: "skipped",
    skipReason,
    message,
    summary: extra?.summary,
    issueType: extra?.issueType,
  });
}

async function recordEnqueue(
  jiraKey: string,
  source: IntakeEventSource | "manual",
  input: { summary: string; issueType: string; pipelineStarted: boolean }
): Promise<void> {
  const organizationId = getActiveOrganizationId();
  if (!organizationId) return;
  await recordIntakeEvent({
    organizationId,
    jiraKey,
    source: normalizeSource(source),
    outcome: "enqueued",
    message: input.pipelineStarted
      ? "New work assigned — pipeline started"
      : "New work assigned — queued for pipeline",
    summary: input.summary,
    issueType: input.issueType,
  });
}

async function recordFailure(
  jiraKey: string,
  source: IntakeEventSource | "manual",
  message: string
): Promise<void> {
  const organizationId = getActiveOrganizationId();
  if (!organizationId) return;
  await recordIntakeEvent({
    organizationId,
    jiraKey,
    source: normalizeSource(source),
    outcome: "failed",
    message,
  });
}

async function syncJiraIssueFromFetch(issue: PipelineJiraIssue): Promise<void> {
  const fetched = mapJiraApiIssue(
    {
      id: issue.id,
      key: issue.key,
      fields: issue.fields as Record<string, unknown>,
    },
    15
  );
  await upsertJiraIssueRecord(fetched);
}

export async function tryIntakeEnqueueFromWebhook(
  payload: PipelineJiraWebhookPayload
): Promise<IntakeEnqueueResult | null> {
  const jiraKey = payload.issue?.key?.trim();
  if (!jiraKey) return null;
  return tryIntakeEnqueue(jiraKey, "webhook");
}

export async function tryIntakeEnqueue(
  jiraKey: string,
  source: IntakeEventSource | "manual" = "manual",
  pmContext?: PmPipelineContext
): Promise<IntakeEnqueueResult> {
  try {
    const rootIssue = await fetchPipelineIssue(jiraKey);
    await syncJiraIssueFromFetch(rootIssue);

    const rootStatus =
      (rootIssue.fields as { status?: { name?: string } }).status?.name ?? "";
    const engineeringIntake = Boolean(pmContext);
    const configuredStatuses = engineeringIntake ? [] : await getAiWorkerIntakeStatusesLive();
    const liveColumnStatuses = engineeringIntake ? [] : await getLiveAiWorkerColumnStatuses();

    if (
      !engineeringIntake &&
      !(await isIssueInAiWorkerIntake(rootStatus))
    ) {
      await recordSkip(
        jiraKey,
        source,
        "not_in_intake_status",
        formatIntakeStatusSkipMessage(
          jiraKey,
          rootStatus,
          configuredStatuses,
          liveColumnStatuses
        )
      );
      return {
        sourceKey: jiraKey,
        enqueued: 0,
        skipped: 1,
        started: false,
        groups: [],
      };
    }

    const decomposed = engineeringIntake
      ? decomposeFromPipelineIssue(rootIssue)
      : await decomposeForPipelineIntake(jiraKey);
    if (decomposed.groups.length === 0) {
      await recordSkip(
        jiraKey,
        source,
        "unsupported_issue_type",
        `${jiraKey} is ${decomposed.sourceIssueType} — AI Worker only accepts ${aiWorkerEligibleTypeLabel()}`,
        { issueType: decomposed.sourceIssueType }
      );
      return {
        sourceKey: jiraKey,
        enqueued: 0,
        skipped: 1,
        started: false,
        groups: [],
      };
    }

    const batchItems: Array<{ ticketId: string; jiraKey: string }> = [];
    let skipped = 0;
    let virinStarted = 0;

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
        if (await isJiraKeyInPipelineQueue(taskKey)) {
          skipped += 1;
          await recordSkip(
            taskKey,
            source,
            "already_queued",
            `${taskKey} is already pending or active in the pipeline queue`
          );
          continue;
        }

        const dedup = await shouldEnqueueJiraKey(taskKey, {
          source,
          engineeringOnly: engineeringIntake,
        });
        if (!dedup.enqueue) {
          skipped += 1;
          await recordSkip(
            taskKey,
            source,
            dedup.reason!,
            dedup.message ?? dedup.reason!
          );
          continue;
        }

        const issue =
          taskKey === jiraKey ? rootIssue : await fetchPipelineIssue(taskKey);
        if (taskKey !== jiraKey) {
          await syncJiraIssueFromFetch(issue);
        }

        const issueStatus =
          (issue.fields as { status?: { name?: string } }).status?.name ?? "";
        if (
          !engineeringIntake &&
          !(await isIssueInAiWorkerIntake(issueStatus))
        ) {
          skipped += 1;
          await recordSkip(
            taskKey,
            source,
            "not_in_intake_status",
            formatIntakeStatusSkipMessage(
              taskKey,
              issueStatus,
              configuredStatuses,
              liveColumnStatuses
            )
          );
          continue;
        }

        const normalized = normalizePipelineIssue(issue);
        const taskIntent = classifyAiWorkerIntake(normalized);

        if (!taskIntent.requiresPipeline) {
          skipped += 1;
          await recordSkip(
            taskKey,
            source,
            "unsupported_issue_type",
            taskIntent.skipReason ?? `${taskKey} does not require pipeline processing`
          );
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
          rawPayload: issue as unknown as Prisma.InputJsonValue,
          normalizedData: enrichedNormalized as unknown as Prisma.InputJsonValue,
          status: "RECEIVED",
        });

        if (engineeringIntake) {
          batchItems.push({ ticketId: ticket.id, jiraKey: normalized.jiraKey });
        } else {
          const existingVirin = pmAnalysisStore.get(normalized.jiraKey);
          const virinActive =
            existingVirin &&
            (existingVirin.status === "RUNNING" ||
              existingVirin.status === "AWAITING_INPUT" ||
              existingVirin.status === "AWAITING_CONFIRMATION" ||
              isPmAnalysisRunning(normalized.jiraKey));

          if (!virinActive && existingVirin?.status !== "COMPLETED") {
            startPmAnalysisInBackground(
              normalized.jiraKey,
              () =>
                runPmAnalysisPipeline({
                  jiraKey: normalized.jiraKey,
                  mode: "interactive",
                  ticket: {
                    jiraKey: normalized.jiraKey,
                    summary: normalized.summary,
                    description: normalized.description,
                    components: normalized.components ?? [],
                    issueType: normalized.issueType,
                  },
                }),
              { organizationId: getActiveOrganizationId() ?? undefined }
            );
            virinStarted += 1;
            await recordIntakeEvent({
              organizationId: getActiveOrganizationId()!,
              jiraKey: normalized.jiraKey,
              source: normalizeSource(source),
              outcome: "enqueued",
              message: "Virin product analysis started (interactive)",
              summary: normalized.summary,
              issueType: normalized.issueType,
            }).catch(() => undefined);
          } else if (virinActive) {
            skipped += 1;
            await recordSkip(
              taskKey,
              source,
              "virin_active",
              `${taskKey} Virin analysis already active`
            );
          } else {
            skipped += 1;
            await recordSkip(
              taskKey,
              source,
              "virin_completed",
              `${taskKey} Virin analysis already completed`
            );
          }
        }
      }
    }

    const batchResult =
      batchItems.length > 0
        ? await enqueuePipelineBatch(
            batchItems,
            getActiveOrganizationId() ?? undefined
          )
        : { started: false, enqueued: 0 };

    const totalEnqueued = batchResult.enqueued + virinStarted;

    if (totalEnqueued > 0) {
      const rootSummary =
        decomposed.groups[0]?.storySummary ??
        (rootIssue.fields as { summary?: string }).summary ??
        jiraKey;
      await recordEnqueue(decomposed.sourceKey, source, {
        summary: rootSummary,
        issueType: decomposed.sourceIssueType,
        pipelineStarted: batchResult.started || virinStarted > 0,
      });
    } else if (skipped > 0) {
      await recordSkip(
        decomposed.sourceKey,
        source,
        "intake_skipped",
        `${decomposed.sourceKey} was not enqueued (${skipped} skip${skipped === 1 ? "" : "s"}) — see intake diagnostics for details`
      );
    }

    return {
      sourceKey: decomposed.sourceKey,
      enqueued: totalEnqueued,
      skipped,
      started: batchResult.started || virinStarted > 0,
      groups: decomposed.groups.map((g) => ({
        storyKey: g.storyKey,
        taskKeys: g.taskKeys,
      })),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordFailure(jiraKey, source, message);
    throw err;
  }
}

async function fetchPipelineIssue(jiraKey: string): Promise<PipelineJiraIssue> {
  const client = getPipelineJiraClient();
  return (await client.getIssueWithFields<PipelineJiraIssue>(
    jiraKey,
    [...JIRA_ISSUE_FETCH_FIELDS]
  )) as PipelineJiraIssue;
}

/** Fast path after Virin handoff — one Jira fetch, no board status checks. */
export async function tryEngineeringIntakeEnqueue(
  jiraKey: string,
  pmContext: PmPipelineContext,
  source: IntakeEventSource | "manual" = "manual"
): Promise<IntakeEnqueueResult> {
  const key = jiraKey.trim().toUpperCase();

  try {
    const dedup = await shouldEnqueueJiraKey(key, { source: "manual", engineeringOnly: true });
    if (!dedup.enqueue) {
      await recordSkip(key, source, dedup.reason!, dedup.message ?? dedup.reason!);
      return {
        sourceKey: key,
        enqueued: 0,
        skipped: 1,
        started: false,
        groups: [],
      };
    }

    const rootIssue = await fetchPipelineIssue(key);
    await syncJiraIssueFromFetch(rootIssue);

    const decomposed = decomposeFromPipelineIssue(rootIssue);
    if (decomposed.groups.length === 0) {
      await recordSkip(
        key,
        source,
        "unsupported_issue_type",
        `${key} is ${decomposed.sourceIssueType} — not eligible for engineering pipeline`,
        { issueType: decomposed.sourceIssueType }
      );
      return {
        sourceKey: key,
        enqueued: 0,
        skipped: 1,
        started: false,
        groups: [],
      };
    }

    const normalized = normalizePipelineIssue(rootIssue);
    const enrichedNormalized = {
      ...normalized,
      createdAt: normalized.createdAt.toISOString(),
      pmContext,
    };

    const ticket = await ticketRepo.create({
      jiraTicketId: normalized.jiraTicketId,
      jiraKey: normalized.jiraKey,
      rawPayload: rootIssue as unknown as Prisma.InputJsonValue,
      normalizedData: enrichedNormalized as unknown as Prisma.InputJsonValue,
      status: "RECEIVED",
    });

    const batchResult = await enqueuePipelineBatch(
      [{ ticketId: ticket.id, jiraKey: normalized.jiraKey }],
      getActiveOrganizationId() ?? undefined
    );

    if (batchResult.enqueued > 0) {
      await recordEnqueue(key, source, {
        summary: normalized.summary || key,
        issueType: decomposed.sourceIssueType,
        pipelineStarted: batchResult.started,
      });
    }

    return {
      sourceKey: key,
      enqueued: batchResult.enqueued,
      skipped: batchResult.enqueued > 0 ? 0 : 1,
      started: batchResult.started,
      groups: decomposed.groups.map((g) => ({
        storyKey: g.storyKey,
        taskKeys: g.taskKeys,
      })),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await recordFailure(key, source, message);
    throw err;
  }
}
