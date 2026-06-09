import crypto from "node:crypto";
import type { Request, Response } from "express";
import { logger } from "../../utils/logger";
import { getPipelineWebhookSecret } from "./credentialsStore";
import { isPipelineIntakeStatus } from "./intakeConfig";
import { type PipelineJiraWebhookPayload } from "./ticketNormalizer";
import { upsertJiraIssueFromWebhook, handleJiraIssueDeleted } from "../../jira-sync/webhookBridge";
import { enqueueIntakeFromWebhook } from "./intakeEnqueueService";

/** Jira Cloud signs with X-Hub-Signature; legacy manual tests may use x-agentos-secret. */
function verifyPipelineWebhook(req: Request): boolean {
  const expected = getPipelineWebhookSecret();
  if (!expected) return true;

  const agentosSecret = req.header("x-agentos-secret");
  if (agentosSecret === expected) return true;

  const rawBody = (req as Request & { rawBody?: string }).rawBody ?? "";
  const hubSignature =
    req.header("x-hub-signature") ?? req.header("X-Hub-Signature");
  if (hubSignature && rawBody) {
    const provided = hubSignature.startsWith("sha256=")
      ? hubSignature
      : `sha256=${hubSignature}`;
    const computed = `sha256=${crypto
      .createHmac("sha256", expected)
      .update(rawBody)
      .digest("hex")}`;
    try {
      return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(computed));
    } catch {
      return false;
    }
  }

  return false;
}

function enteredIntakeStatus(payload: PipelineJiraWebhookPayload): boolean {
  const changelog = (
    payload as {
      changelog?: {
        items?: Array<{ field?: string; toString?: string }>;
      };
    }
  ).changelog;

  if (changelog?.items?.length) {
    const statusChange = changelog.items.find((i) => i.field === "status");
    if (!statusChange) return false;
    return isPipelineIntakeStatus(statusChange.toString);
  }

  const currentStatus =
    (payload.issue.fields as { status?: { name?: string } }).status?.name ?? "";
  return isPipelineIntakeStatus(currentStatus);
}

/** issue_updated in AI Worker column → decompose + queued pipeline; closed/done → mirror. */
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

  if (
    event === "jira:issue_updated" ||
    event === "jira:issue_created"
  ) {
    void handleIssueUpsert(payload).catch((err) =>
      logger.error({ err, event }, "pipeline jira issue upsert failed")
    );
  }

  if (event === "jira:issue_deleted") {
    void handleJiraIssueDeleted(payload.issue.key).catch((err) =>
      logger.error({ err }, "pipeline jira issue delete failed")
    );
  }
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
