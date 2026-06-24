import { prisma } from "../../db/client";
import { ticketRepo } from "../../db/repositories/ticketRepo";
import { isJiraKeyInDbQueue } from "../../queue/pipelineQueueStore";
import { recordIntakeEvent } from "../../db/repositories/intakeEventRepo";
import { getActiveOrganizationId } from "../../organization/context";
import { logger } from "../../utils/logger";
import { pmAnalysisStore } from "../../agents/pm/store";
import { isPmAnalysisRunning } from "../../agents/pm/backgroundRunner";

export type IntakeSkipReason =
  | "already_queued"
  | "already_processing"
  | "already_completed"
  | "ticket_completed"
  | "pipeline_active"
  | "awaiting_human"
  | "pipeline_failed"
  | "virin_active"
  | "virin_completed"
  | "not_in_intake_status"
  | "unsupported_issue_type";

export interface ShouldEnqueueOptions {
  /** Manual scan / re-run bypasses failed-pipeline guard. */
  source?: "webhook" | "scan" | "poll" | "manual" | "startup";
  /** Engineering enqueue after Virin handoff — bypasses virin_completed guard. */
  engineeringOnly?: boolean;
}

export interface ShouldEnqueueResult {
  enqueue: boolean;
  reason?: IntakeSkipReason;
  message?: string;
}

export async function shouldEnqueueJiraKey(
  jiraKey: string,
  options: ShouldEnqueueOptions = {}
): Promise<ShouldEnqueueResult> {
  const source = options.source ?? "webhook";

  if (await isJiraKeyInDbQueue(jiraKey)) {
    return {
      enqueue: false,
      reason: "already_queued",
      message: `${jiraKey} is already pending or active in the pipeline queue`,
    };
  }

  const virinRecord = pmAnalysisStore.get(jiraKey);

  // Post-Virin engineering handoff — skip Virin guards (auto-start runs before
  // backgroundRunner clears `running`, which would otherwise look "virin_active").
  if (!options.engineeringOnly) {
    if (
      virinRecord &&
      (virinRecord.status === "RUNNING" ||
        virinRecord.status === "AWAITING_INPUT" ||
        virinRecord.status === "AWAITING_CONFIRMATION" ||
        isPmAnalysisRunning(jiraKey))
    ) {
      return {
        enqueue: false,
        reason: "virin_active",
        message: `${jiraKey} Virin analysis is active (${virinRecord.status})`,
      };
    }

    if (virinRecord?.status === "COMPLETED" && source !== "manual") {
      return {
        enqueue: false,
        reason: "virin_completed",
        message: `${jiraKey} Virin analysis completed — engineering pipeline may already be queued`,
      };
    }
  }

  const ticket = await ticketRepo.findByJiraKey(jiraKey);

  const activePipeline = ticket
    ? await prisma.pipeline.findFirst({
        where: {
          ticketId: ticket.id,
          status: { in: ["RUNNING", "PAUSED"] },
        },
        orderBy: { startedAt: "desc" },
      })
    : null;

  if (activePipeline) {
    return {
      enqueue: false,
      reason: "pipeline_active",
      message: `${jiraKey} already has an active pipeline (${activePipeline.status})`,
    };
  }

  if (ticket?.status === "PROCESSING") {
    return {
      enqueue: false,
      reason: "already_processing",
      message: `${jiraKey} is currently being processed`,
    };
  }

  if (ticket?.status === "AWAITING_HUMAN") {
    return {
      enqueue: false,
      reason: "awaiting_human",
      message: `${jiraKey} is paused awaiting human review — resume or override before re-intake`,
    };
  }

  if (ticket?.status === "COMPLETED") {
    const latestPipeline = await prisma.pipeline.findFirst({
      where: { ticketId: ticket.id },
      orderBy: { startedAt: "desc" },
    });
    if (latestPipeline?.status === "COMPLETED") {
      return {
        enqueue: false,
        reason: "already_completed",
        message: `${jiraKey} already has a completed pipeline run`,
      };
    }
  }

  if (ticket) {
    const completedPipeline = await prisma.pipeline.findFirst({
      where: { ticketId: ticket.id, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
    });
    if (completedPipeline) {
      return {
        enqueue: false,
        reason: "ticket_completed",
        message: `${jiraKey} pipeline completed at ${completedPipeline.completedAt?.toISOString() ?? "unknown"}`,
      };
    }

    if (source !== "manual") {
      const failedPipeline = await prisma.pipeline.findFirst({
        where: { ticketId: ticket.id, status: "FAILED" },
        orderBy: { startedAt: "desc" },
      });
      if (failedPipeline) {
        return {
          enqueue: false,
          reason: "pipeline_failed",
          message: `${jiraKey} pipeline failed — use Re-run in the dashboard instead of auto re-intake`,
        };
      }
    }
  }

  return { enqueue: true };
}

export async function logIntakeSkipped(
  jiraKey: string,
  reason: IntakeSkipReason,
  message: string,
  source: "webhook" | "scan" | "poll" | "manual" | "startup"
): Promise<void> {
  logger.info({ jiraKey, reason, message, source }, "INTAKE_SKIPPED");
  const organizationId = getActiveOrganizationId();
  if (!organizationId) return;
  await recordIntakeEvent({
    organizationId,
    jiraKey,
    source,
    outcome: "skipped",
    skipReason: reason,
    message,
  }).catch((err) => {
    logger.warn({ err, jiraKey }, "failed to persist intake skip event");
  });
}
