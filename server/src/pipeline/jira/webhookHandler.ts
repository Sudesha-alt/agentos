import crypto from "node:crypto";
import type { Request, Response } from "express";
import { prisma } from "../../db/client";
import { withOrganizationContext } from "../../api/orgRequestContext";
import { logger } from "../../utils/logger";
import {
  listOrganizationIdsWithJiraConfig,
  resolveOrganizationByJiraProjectKey,
  resolveOrganizationByJiraWebhookSecret,
} from "../../organization/webhookResolver";
import {
  extractBearerToken,
  verifyAtlassianOAuthWebhookJwt,
} from "./jiraWebhookAuth";
import { isPipelineIntakeStatus, getPipelineIntakeStatuses } from "./intakeConfig";
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
  if (hubSignature && rawBody) {
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
  }

  // OAuth 2.0 dynamic webhooks: Authorization Bearer JWT signed with app client secret.
  const clientSecret = process.env.ATLASSIAN_CLIENT_SECRET?.trim();
  const bearer = extractBearerToken(req.header("authorization"));
  if (bearer && clientSecret && verifyAtlassianOAuthWebhookJwt(bearer, clientSecret)) {
    const payload = req.body as PipelineJiraWebhookPayload | undefined;
    const projectKey = (
      payload?.issue?.fields as { project?: { key?: string } } | undefined
    )?.project?.key;
    if (projectKey) {
      const orgId = await resolveOrganizationByJiraProjectKey(projectKey);
      if (orgId) return orgId;
    }
    const orgIds = await listOrganizationIdsWithJiraConfig();
    if (orgIds.length === 1) return orgIds[0]!;
  }

  return null;
}

function enteredIntakeStatus(payload: PipelineJiraWebhookPayload): boolean {
  const changelog = (
    payload as {
      changelog?: {
        items?: Array<{
          field?: string;
          fieldId?: string;
          toString?: string;
          fromString?: string;
        }>;
      };
    }
  ).changelog;

  const currentStatus =
    (payload.issue.fields as { status?: { name?: string } }).status?.name ?? "";

  if (payload.webhookEvent === "jira:issue_created") {
    return isPipelineIntakeStatus(currentStatus);
  }

  if (payload.webhookEvent === "jira:issue_updated") {
    const statusChange = changelog?.items?.find(
      (i) => i.field === "status" || i.fieldId === "status"
    );
    if (statusChange) {
      return (
        isPipelineIntakeStatus(statusChange.toString) &&
        !isPipelineIntakeStatus(statusChange.fromString)
      );
    }

    // OAuth dynamic webhooks and some board moves omit changelog — align with poll/scan.
    if (isPipelineIntakeStatus(currentStatus)) {
      return true;
    }
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

  if (!enteredIntakeStatus(payload)) {
    logger.info(
      {
        jiraKey,
        statusName,
        event: payload.webhookEvent,
        hasChangelog: Boolean(
          (payload as { changelog?: { items?: unknown[] } }).changelog?.items?.length
        ),
        intakeStatuses: getPipelineIntakeStatuses(),
      },
      "pipeline jira webhook: issue updated but not an AI Worker intake transition"
    );
    return;
  }

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
