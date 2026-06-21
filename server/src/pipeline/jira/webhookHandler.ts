import crypto from "node:crypto";
import type { Request, Response } from "express";
import { prisma } from "../../db/client";
import { withOrganizationContext } from "../../api/orgRequestContext";
import { logger } from "../../utils/logger";
import { resolveOrganizationByJiraWebhookSecret } from "../../organization/webhookResolver";
import { isPipelineIntakeStatus } from "./intakeConfig";
import { type PipelineJiraWebhookPayload } from "./ticketNormalizer";
import { upsertJiraIssueFromWebhook, handleJiraIssueDeleted } from "../../jira-sync/webhookBridge";
import { enqueueIntakeFromWebhook } from "./intakeEnqueueService";

async function resolveWebhookOrganization(req: Request): Promise<string | null> {
  const agentosSecret = req.header("x-agentos-secret")?.trim();
  if (agentosSecret) {
    return resolveOrganizationByJiraWebhookSecret(agentosSecret);
  }

  const rawBody = (req as Request & { rawBody?: string }).rawBody ?? "";
  const hubSignature =
    req.header("x-hub-signature") ?? req.header("X-Hub-Signature");
  if (!hubSignature || !rawBody) return null;

  const provided = hubSignature.startsWith("sha256=")
    ? hubSignature
    : `sha256=${hubSignature}`;

  const configs = await prisma.organizationJiraConfig.findMany({
    where: { webhookSecret: { not: "" } },
    select: { organizationId: true, webhookSecret: true },
  });

  for (const config of configs) {
    const computed = `sha256=${crypto
      .createHmac("sha256", config.webhookSecret)
      .update(rawBody)
      .digest("hex")}`;
    try {
      if (crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(computed))) {
        return config.organizationId;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function enteredIntakeStatus(payload: PipelineJiraWebhookPayload): boolean {
  const changelog = (
    payload as {
      changelog?: {
        items?: Array<{ field?: string; toString?: string; fromString?: string }>;
      };
    }
  ).changelog;

  const currentStatus =
    (payload.issue.fields as { status?: { name?: string } }).status?.name ?? "";

  if (payload.webhookEvent === "jira:issue_created") {
    return isPipelineIntakeStatus(currentStatus);
  }

  if (changelog?.items?.length) {
    const statusChange = changelog.items.find((i) => i.field === "status");
    if (!statusChange) return false;
    const entered =
      isPipelineIntakeStatus(statusChange.toString) &&
      !isPipelineIntakeStatus(statusChange.fromString);
    return entered;
  }

  return false;
}

/** issue_updated in AI Worker column → decompose + queued pipeline; closed/done → mirror. */
export async function handlePipelineJiraWebhook(
  req: Request,
  res: Response
): Promise<void> {
  const organizationId = await resolveWebhookOrganization(req);
  if (!organizationId) {
    logger.warn({ ip: req.ip }, "rejected pipeline jira webhook — unknown org or bad secret");
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

  void withOrganizationContext(organizationId, async () => {
    if (event === "jira:issue_updated" || event === "jira:issue_created") {
      await handleIssueUpsert(payload);
    }

    if (event === "jira:issue_deleted") {
      await handleJiraIssueDeleted(payload.issue.key);
    }
  }).catch((err) => logger.error({ err, event, organizationId }, "pipeline jira webhook failed"));
}

async function handleIssueUpsert(
  payload: PipelineJiraWebhookPayload
): Promise<void> {
  const jiraKey = payload.issue.key;
  const statusName =
    (payload.issue.fields as { status?: { name?: string } }).status?.name ?? "";

  logger.info({ jiraKey, statusName }, "pipeline jira webhook: issue upsert");

  await upsertJiraIssueFromWebhook(payload);

  if (enteredIntakeStatus(payload)) {
    const result = await enqueueIntakeFromWebhook(payload);
    if (result) {
      logger.info(
        {
          sourceKey: result.sourceKey,
          enqueued: result.enqueued,
          skipped: result.skipped,
          started: result.started,
          groups: result.groups,
        },
        result.started
          ? "pipeline intake started after decomposition"
          : "pipeline intake queued after decomposition"
      );
    }
  }
}
