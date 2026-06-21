import crypto from "node:crypto";
import type { Request, Response } from "express";
import { prisma } from "../../db/client";
import { withOrganizationContext } from "../../api/orgRequestContext";
import { logger } from "../../utils/logger";
import {
  listOrganizationIdsWithJiraConfig,
  projectKeyFromIssueKey,
  resolveOrganizationByJiraProjectKey,
  resolveOrganizationByJiraWebhookSecret,
} from "../../organization/webhookResolver";
import {
  extractBearerToken,
  verifyAtlassianOAuthWebhookJwt,
} from "./jiraWebhookAuth";
import {
  getPipelineIntakeStatuses,
  isPipelineIntakeStatus,
} from "./intakeConfig";
import { type PipelineJiraWebhookPayload } from "./ticketNormalizer";
import { upsertJiraIssueFromWebhook, handleJiraIssueDeleted } from "../../jira-sync/webhookBridge";
import { tryIntakeEnqueue } from "./intakeOrchestrator";
import { recordWebhookReceipt } from "./intakeDiagnosticsStore";

async function resolveWebhookOrganization(
  req: Request,
  payload?: PipelineJiraWebhookPayload
): Promise<string | null> {
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

  const clientSecret = process.env.ATLASSIAN_CLIENT_SECRET?.trim();
  const bearer = extractBearerToken(req.header("authorization"));
  const jwtOk = Boolean(
    bearer && clientSecret && verifyAtlassianOAuthWebhookJwt(bearer, clientSecret)
  );

  if (jwtOk) {
    const projectKey =
      (payload?.issue?.fields as { project?: { key?: string } } | undefined)
        ?.project?.key ?? projectKeyFromIssueKey(payload?.issue?.key);
    if (projectKey) {
      const orgId = await resolveOrganizationByJiraProjectKey(projectKey);
      if (orgId) return orgId;
    }
    const orgIds = await listOrganizationIdsWithJiraConfig();
    if (orgIds.length === 1) return orgIds[0]!;
  }

  if (bearer && clientSecret && !jwtOk) {
    logger.warn(
      { hasAuthorization: true, jiraKey: payload?.issue?.key },
      "pipeline jira webhook JWT verification failed"
    );
  }

  return null;
}

function shouldAttemptIntake(payload: PipelineJiraWebhookPayload): boolean {
  const currentStatus =
    (payload.issue.fields as { status?: { name?: string } }).status?.name ?? "";

  if (payload.webhookEvent === "jira:issue_created") {
    return isPipelineIntakeStatus(currentStatus) || !currentStatus.trim();
  }

  if (payload.webhookEvent !== "jira:issue_updated") {
    return false;
  }

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

  const statusChange = changelog?.items?.find(
    (i) => i.field === "status" || i.fieldId === "status"
  );
  if (statusChange) {
    return (
      isPipelineIntakeStatus(statusChange.toString) &&
      !isPipelineIntakeStatus(statusChange.fromString)
    );
  }

  // OAuth dynamic webhooks often omit changelog — verify via REST in enqueue.
  return isPipelineIntakeStatus(currentStatus) || !currentStatus.trim();
}

/** issue_updated in AI Worker column → decompose + queued pipeline; closed/done → mirror. */
export async function handlePipelineJiraWebhook(
  req: Request,
  res: Response
): Promise<void> {
  const payload = req.body as PipelineJiraWebhookPayload | undefined;
  const organizationId = await resolveWebhookOrganization(req, payload);
  if (!organizationId) {
    logger.warn(
      {
        ip: req.ip,
        hasHubSignature: Boolean(req.header("x-hub-signature")),
        hasAuthorization: Boolean(req.header("authorization")),
        jiraKey: payload?.issue?.key,
      },
      "rejected pipeline jira webhook — unknown org or bad secret"
    );
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  const event = payload?.webhookEvent;

  if (!payload?.issue?.key || !event) {
    res.status(200).json({ ok: true, action: "ignored" });
    return;
  }

  res.status(200).json({ ok: true, event });

  void withOrganizationContext(organizationId, async () => {
    if (event === "jira:issue_updated" || event === "jira:issue_created") {
      recordWebhookReceipt(organizationId, payload.issue.key);
      await handleIssueUpsert(payload);
    }

    if (event === "jira:issue_deleted") {
      await handleJiraIssueDeleted(payload.issue.key);
    }
  }).catch((err) =>
    logger.error({ err, event, organizationId, jiraKey: payload.issue.key }, "pipeline jira webhook failed")
  );
}

async function handleIssueUpsert(
  payload: PipelineJiraWebhookPayload
): Promise<void> {
  const jiraKey = payload.issue.key;
  const statusName =
    (payload.issue.fields as { status?: { name?: string } }).status?.name ?? "";

  logger.info({ jiraKey, statusName, event: payload.webhookEvent }, "pipeline jira webhook: issue upsert");

  await upsertJiraIssueFromWebhook(payload);

  if (!shouldAttemptIntake(payload)) {
    logger.info(
      {
        jiraKey,
        statusName,
        event: payload.webhookEvent,
        intakeStatuses: getPipelineIntakeStatuses(),
      },
      "pipeline jira webhook: skipped intake — status not in AI Worker column"
    );
    return;
  }

  const result = await tryIntakeEnqueue(jiraKey, "webhook");

  logger.info(
    {
      jiraKey,
      enqueued: result.enqueued,
      skipped: result.skipped,
      started: result.started,
    },
    result.enqueued > 0
      ? "pipeline intake enqueued from webhook"
      : "pipeline intake skipped after webhook fetch"
  );
}
