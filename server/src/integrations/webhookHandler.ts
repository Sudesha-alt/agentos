import type { Request, Response } from "express";
import type { Prisma } from "../db/prisma";
import { ticketRepo } from "../db/repositories/ticketRepo";
import { runPipelineInBackground } from "../queue/inProcessRunner";
import { logger } from "../utils/logger";
import { classifyIntent } from "./intentClassifier";
import { normalizeTicket, type JiraWebhookPayload } from "./ticketNormalizer";

export async function handleJiraWebhook(
  req: Request,
  res: Response
): Promise<void> {
  // Ack first so Jira's webhook delivery is never blocked on our processing.
  res.status(200).json({ received: true });

  const payload = req.body as JiraWebhookPayload | undefined;
  if (!payload || payload.webhookEvent !== "jira:issue_created") return;

  try {
    logger.info(
      {
        jiraKey: payload.issue.key,
        issueType: payload.issue.fields.issuetype?.name,
      },
      "webhook received"
    );

    const normalizedTicket = normalizeTicket(payload);
    const intent = classifyIntent(normalizedTicket);

    if (!intent.requiresPipeline) {
      logger.info(
        { jiraKey: normalizedTicket.jiraKey, reason: intent.skipReason },
        "ticket skipped — below pipeline threshold"
      );
      return;
    }

    const ticket = await ticketRepo.create({
      jiraTicketId: normalizedTicket.jiraTicketId,
      jiraKey: normalizedTicket.jiraKey,
      rawPayload: payload as unknown as Prisma.InputJsonValue,
      normalizedData: {
        ...normalizedTicket,
        createdAt: normalizedTicket.createdAt.toISOString(),
      } as unknown as Prisma.InputJsonValue,
      status: "RECEIVED",
    });

    runPipelineInBackground(ticket.id);

    logger.info({ ticketId: ticket.id }, "pipeline started in-process");
  } catch (error) {
    logger.error({ err: error }, "webhook processing failed");
  }
}
