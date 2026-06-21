import { prisma } from "../../db/client";
import { ticketRepo } from "../../db/repositories/ticketRepo";
import { isJiraKeyInDbQueue } from "../../queue/pipelineQueueStore";
import { logger } from "../../utils/logger";

export type IntakeSkipReason =
  | "already_queued"
  | "already_processing"
  | "already_completed"
  | "ticket_completed"
  | "not_in_intake_status"
  | "unsupported_issue_type";

export interface ShouldEnqueueResult {
  enqueue: boolean;
  reason?: IntakeSkipReason;
  message?: string;
}

export async function shouldEnqueueJiraKey(jiraKey: string): Promise<ShouldEnqueueResult> {
  if (isJiraKeyInDbQueue(jiraKey)) {
    return {
      enqueue: false,
      reason: "already_queued",
      message: `${jiraKey} is already pending or active in the pipeline queue`,
    };
  }

  const ticket = await ticketRepo.findByJiraKey(jiraKey);
  if (ticket?.status === "PROCESSING") {
    return {
      enqueue: false,
      reason: "already_processing",
      message: `${jiraKey} is currently being processed`,
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
}
