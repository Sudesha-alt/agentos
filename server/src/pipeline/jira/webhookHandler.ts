import type { Request, Response } from "express";
import type { Prisma } from "../../db/prisma";
import { ticketRepo } from "../../db/repositories/ticketRepo";
import { jobQueue, JOB_NAMES } from "../../queue/jobQueue";
import { classifyIntent } from "../../integrations/intentClassifier";
import { logger } from "../../utils/logger";
import { getPipelineWebhookSecret } from "./credentialsStore";
import {
  normalizePipelineTicket,
  type PipelineJiraWebhookPayload,
} from "./ticketNormalizer";
import { syncMirroredIssue } from "./mirror/syncService";

function verifyPipelineWebhook(req: Request): boolean {
  const expected = getPipelineWebhookSecret();
  if (!expected) return true;
  const provided = req.header("x-agentos-secret");
  return provided === expected;
}

/** Lane 2: issue_created → pipeline; issue_updated → selective mirror sync. */
export async function handlePipelineJiraWebhook(
  req: Request,
  res: Response
): Promise<void> {
  if (!verifyPipelineWebhook(req)) {
    logger.warn({ ip: req.ip }, "rejected pipeline jira webhook — bad secret");
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const payload = req.body as PipelineJiraWebhookPayload | undefined;
  const event = payload?.webhookEvent;

  if (!payload?.issue?.key || !event) {
    res.status(200).json({ ok: true, action: "ignored" });
    return;
  }

  res.status(200).json({ ok: true, event });

  if (event === "jira:issue_created") {
    void handleIssueCreated(payload).catch((err) =>
      logger.error({ err }, "pipeline issue_created failed")
    );
    return;
  }

  if (event === "jira:issue_updated") {
    void handleIssueUpdated(payload).catch((err) =>
      logger.error({ err }, "pipeline issue_updated mirror sync failed")
    );
  }
}

async function handleIssueCreated(
  payload: PipelineJiraWebhookPayload
): Promise<void> {
  logger.info(
    {
      jiraKey: payload.issue.key,
      issueType: payload.issue.fields.issuetype?.name,
    },
    "pipeline jira webhook: issue_created"
  );

  const normalizedTicket = normalizePipelineTicket(payload);
  const intent = classifyIntent(normalizedTicket);

  if (!intent.requiresPipeline) {
    logger.info(
      { jiraKey: normalizedTicket.jiraKey, reason: intent.skipReason },
      "pipeline ticket skipped"
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

  await jobQueue.add(
    JOB_NAMES.RUN_PIPELINE,
    { ticketId: ticket.id },
    { attempts: 3, backoff: { type: "exponential", delay: 5000 } }
  );

  logger.info({ ticketId: ticket.id }, "pipeline job queued");
}

async function handleIssueUpdated(
  payload: PipelineJiraWebhookPayload
): Promise<void> {
  const jiraKey = payload.issue.key;
  const statusName =
    (payload.issue.fields as { status?: { name?: string } }).status?.name ??
    "";

  logger.info({ jiraKey, statusName }, "pipeline jira webhook: issue_updated");

  const result = await syncMirroredIssue(jiraKey);
  if (result.synced) {
    logger.info({ jiraKey }, "mirror updated from webhook");
  }
}
