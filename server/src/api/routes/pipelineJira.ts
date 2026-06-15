import { Router } from "express";
import {
  connectPipelineJira,
  ensurePipelineJiraWebhook,
  pipelineJiraPublicBase,
  pipelineJiraWebhookUrl,
} from "../../pipeline/jira/connectPipelineJira";
import {
  validatePipelineJiraConfig,
} from "../../pipeline/jira/credentialsStore";
import { getPipelineJiraMirrorConfig } from "../../pipeline/jira/config";
import { buildMirrorBackfillJql } from "../../pipeline/jira/mirror/jql";
import {
  getMirrorStats,
  runMirrorBackfill,
} from "../../pipeline/jira/mirror/syncService";
import {
  getBoardColumnsOrdered,
  listIntakeColumnTickets,
  resolveIntakeStatusesForColumn,
} from "../../pipeline/jira/boardService";
import {
  getPipelineCompletionSettings,
  getPipelineIntakeMapping,
  savePipelineCompletionSettings,
  savePipelineIntakeColumn,
} from "../../pipeline/jira/intakeConfig";
import { getJiraIssueStats } from "../../jira-sync/issueRepository";
import { getLatestSyncRun, isJiraSyncRunning } from "../../jira-sync/syncService";
import { getJiraSyncConfig } from "../../jira-sync/config";
import { scanIntakeFromSyncedIssues } from "../../jira-sync/intakeScan";
import {
  getPipelineQueueState,
  runJiraSyncInBackground,
} from "../../queue/inProcessRunner";
import { resolveUserFromAuthHeader } from "./authSession";
import {
  activateOrganizationJiraContext,
  warmOrganizationJiraCredentials,
} from "../../pipeline/jira/credentialsStore";
import { getPublicOrganizationJiraConfig } from "../../organization/jiraConfigStore";
import {
  requireOrganizationUser,
  withOrganizationContext,
} from "../orgRequestContext";

const router = Router();

router.get("/setup", async (req, res) => {
  const user = requireOrganizationUser(req, res);
  if (!user?.organizationId) return;

  await withOrganizationContext(user.organizationId, async () => {
    const jira = await getPublicOrganizationJiraConfig(user.organizationId!);
    const intake = getPipelineIntakeMapping();
    let connected = false;
    try {
      validatePipelineJiraConfig();
      connected = true;
    } catch {
      connected = jira.configured;
    }

    res.json({
      publicApiBase: pipelineJiraPublicBase(req),
      webhookUrl: pipelineJiraWebhookUrl(req),
      webhookEvents: ["jira:issue_created", "jira:issue_updated", "jira:issue_deleted"],
      webhookHint:
        "All project tickets sync automatically. Move a ticket into the AI Worker column/status to start the agent pipeline.",
      intake,
      queue: getPipelineQueueState(user.organizationId!),
      mirror: getPipelineJiraMirrorConfig(),
      mirrorJql: connected
        ? buildMirrorBackfillJql(jira.projectKeys)
        : null,
      sync: {
        config: getJiraSyncConfig(),
        running: isJiraSyncRunning(user.organizationId),
        latestRun: connected ? await getLatestSyncRun(user.organizationId) : null,
        stats: connected ? await getJiraIssueStats(user.organizationId) : null,
      },
      jira,
      connected,
    });
  });
});

router.post("/connect", async (req, res) => {
  const user = requireOrganizationUser(req, res);
  if (!user?.organizationId) return;
  const organizationId = user.organizationId;

  const baseUrl = String(req.body?.baseUrl ?? "").trim();
  const email = String(req.body?.email ?? "").trim();
  const apiToken = req.body?.apiToken
    ? String(req.body.apiToken).trim()
    : undefined;
  const webhookSecret = req.body?.webhookSecret
    ? String(req.body.webhookSecret).trim()
    : undefined;
  const boardId = req.body?.boardId
    ? String(req.body.boardId).trim()
    : undefined;
  const projectKeysRaw = req.body?.projectKeys;
  const projectKeys = Array.isArray(projectKeysRaw)
    ? projectKeysRaw.map(String)
    : typeof projectKeysRaw === "string"
      ? projectKeysRaw.split(",").map((k: string) => k.trim()).filter(Boolean)
      : undefined;

  if (!baseUrl) {
    res.status(400).json({ error: "baseUrl is required" });
    return;
  }

  const prior = await getPublicOrganizationJiraConfig(organizationId);
  if (!apiToken && !prior.hasApiToken && !prior.connectedViaOAuth) {
    res.status(400).json({ error: "apiToken is required on first connect" });
    return;
  }

  try {
    await withOrganizationContext(organizationId, async () => {
      const webhookUrl = pipelineJiraWebhookUrl(req);
      const result = await connectPipelineJira({
        baseUrl,
        email: email || undefined,
        apiToken,
        webhookSecret,
        projectKeys,
        boardId,
        webhookUrl,
        autoRegisterWebhook: req.body?.autoRegisterWebhook !== false,
        organizationId,
        authMethod: "api_token",
      });
      res.json({
        ...result,
        publicApiBase: pipelineJiraPublicBase(req),
        webhookUrl,
      });
    });
  } catch (err) {
    const e = err as Error;
    res.status(502).json({ error: e.message });
  }
});

router.post("/webhook/register", async (req, res) => {
  const user = requireOrganizationUser(req, res);
  if (!user?.organizationId) return;

  await withOrganizationContext(user.organizationId, async () => {
    const jira = await getPublicOrganizationJiraConfig(user.organizationId!);
    if (!jira.webhookSecret) {
      res.status(400).json({ error: "Connect pipeline Jira first" });
      return;
    }
    try {
      const webhookUrl = pipelineJiraWebhookUrl(req);
      const result = await ensurePipelineJiraWebhook({
        webhookUrl,
        secret: jira.webhookSecret,
        projectKey: jira.projectKeys[0] ?? null,
      });
      res.json({ webhookUrl, ...result });
    } catch (err) {
      const e = err as Error;
      res.status(502).json({ error: e.message });
    }
  });
});

router.get("/boards/columns", async (_req, res, next) => {
  try {
    const columns = await getBoardColumnsOrdered();
    res.json({ columns });
  } catch (err) {
    next(err);
  }
});

router.put("/intake-column", async (req, res, next) => {
  try {
    validatePipelineJiraConfig();
    const columnName = String(req.body?.columnName ?? "").trim();
    if (!columnName) {
      res.status(400).json({ error: "columnName is required" });
      return;
    }
    const columns = await getBoardColumnsOrdered();
    const statuses = resolveIntakeStatusesForColumn(columnName, columns);
    const intake = savePipelineIntakeColumn({
      boardId: req.body?.boardId ? String(req.body.boardId).trim() : undefined,
      columnName,
      statuses,
    });
    res.json(intake);
  } catch (err) {
    next(err);
  }
});

router.get("/intake/tickets", async (_req, res, next) => {
  try {
    validatePipelineJiraConfig();
    const result = await listIntakeColumnTickets();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/completion-settings", (_req, res) => {
  res.json(getPipelineCompletionSettings());
});

router.put("/completion-settings", (req, res) => {
  const settings = savePipelineCompletionSettings({
    completionStatusName: req.body?.completionStatusName
      ? String(req.body.completionStatusName).trim()
      : undefined,
    attachPrdComment: req.body?.attachPrdComment,
    attachQaComment: req.body?.attachQaComment,
    attachRcaComment: req.body?.attachRcaComment,
    updateDescription: req.body?.updateDescription,
    attachJsonArtifact: req.body?.attachJsonArtifact,
  });
  res.json(settings);
});

router.post("/intake/scan", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    await withOrganizationContext(user.organizationId, async () => {
      validatePipelineJiraConfig();
      const result = await scanIntakeFromSyncedIssues("manual");
      res.json({
        ...result,
        queue: getPipelineQueueState(user.organizationId!),
      });
    });
  } catch (err) {
    next(err);
  }
});

router.get("/mirror/stats", async (_req, res, next) => {
  try {
    const stats = await getMirrorStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

router.post("/mirror/backfill", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    await withOrganizationContext(user.organizationId, async () => {
      validatePipelineJiraConfig();
      const projectKeys = Array.isArray(req.body?.projectKeys)
        ? req.body.projectKeys.map(String)
        : undefined;
      const maxIssues = req.body?.maxIssues
        ? Number(req.body.maxIssues)
        : undefined;
      const async = req.body?.async !== false;

      if (async) {
        const { started } = runJiraSyncInBackground({
          mode: "full",
          projectKeys,
          organizationId: user.organizationId!,
        });
        res.status(202).json({
          status: started ? "started" : "already_running",
          deprecated: true,
          use: "POST /jira-sync/run",
        });
        return;
      }

      const result = await runMirrorBackfill({ projectKeys, maxIssues });
      res.json(result);
    });
  } catch (err) {
    next(err);
  }
});

export default router;
