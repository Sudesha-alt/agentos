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
import { ValidationError } from "../../utils/errors";
import { getPipelineJiraMirrorConfig } from "../../pipeline/jira/config";
import { buildMirrorBackfillJql } from "../../pipeline/jira/mirror/jql";
import {
  getMirrorStats,
  runMirrorBackfill,
} from "../../pipeline/jira/mirror/syncService";
import {
  getBoardColumnsOrdered,
  listIntakeColumnTickets,
  listJiraBoards,
  listJiraProjects,
  resolveIntakeStatusesForColumn,
  resolveReferenceStatusesForColumns,
} from "../../pipeline/jira/boardService";
import {
  getPipelineCompletionSettings,
  getPipelineIntakeMapping,
  savePipelineCompletionSettings,
  savePipelineIntakeColumn,
} from "../../pipeline/jira/intakeConfig";
import { reconcileOrganizationJiraIntegration } from "../../pipeline/jira/reconcileIntegration";
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
import { logger } from "../../utils/logger";

const router = Router();

function normalizePipelineError(err: unknown): unknown {
  if (err instanceof ValidationError) return err;
  if (err instanceof Error) {
    if (
      err.message.startsWith("Pipeline Jira not configured") ||
      err.message.startsWith("Pipeline Jira API") ||
      err.message.includes("Jira OAuth")
    ) {
      let message = err.message;
      if (
        /Pipeline Jira API (401|403)/.test(message) &&
        /board|scope|Unauthorized|permission/i.test(message)
      ) {
        message +=
          " — OAuth may be missing Jira Software board scopes. In the Atlassian Developer Console add read:project:jira, read:board-scope:jira-software, and read:board-scope.admin:jira-software, then Disconnect and reconnect Jira in AgentOS.";
      }
      return new ValidationError(message);
    }
  }
  return err;
}

router.get("/setup", async (req, res) => {
  const user = requireOrganizationUser(req, res);
  if (!user?.organizationId) return;

  await withOrganizationContext(user.organizationId, async () => {
    const jira = await getPublicOrganizationJiraConfig(user.organizationId!);
    let pipelineReady = false;
    try {
      validatePipelineJiraConfig();
      pipelineReady = true;
    } catch {
      pipelineReady = false;
    }

    if (jira.configured && !pipelineReady) {
      await reconcileOrganizationJiraIntegration(user.organizationId!, {
        force: true,
      });
      try {
        validatePipelineJiraConfig();
        pipelineReady = true;
      } catch {
        pipelineReady = false;
      }
    } else {
      await reconcileOrganizationJiraIntegration(user.organizationId!);
    }

    const jiraAfter = pipelineReady
      ? jira
      : await getPublicOrganizationJiraConfig(user.organizationId!);
    const connected = pipelineReady;
    const needsReconnect = Boolean(jiraAfter.configured && !pipelineReady);
    const intake = getPipelineIntakeMapping();

    res.json({
      publicApiBase: pipelineJiraPublicBase(req),
      webhookUrl: pipelineJiraWebhookUrl(req),
      webhookEvents: ["jira:issue_created", "jira:issue_updated", "jira:issue_deleted"],
      webhookHint:
        "All project tickets sync automatically. Move a ticket into the AI Worker column/status to start the agent pipeline.",
      intake,
      queue: getPipelineQueueState(user.organizationId!),
      mirror: getPipelineJiraMirrorConfig(),
      mirrorJql: pipelineReady
        ? buildMirrorBackfillJql(jiraAfter.projectKeys)
        : null,
      sync: {
        config: getJiraSyncConfig(),
        running: isJiraSyncRunning(user.organizationId),
        latestRun: pipelineReady ? await getLatestSyncRun(user.organizationId) : null,
        stats: pipelineReady ? await getJiraIssueStats(user.organizationId) : null,
      },
      jira: jiraAfter,
      connected,
      pipelineReady,
      needsReconnect,
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
      const authMethod =
        prior.connectedViaOAuth || prior.authMethod === "oauth"
          ? ("oauth" as const)
          : ("api_token" as const);
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
        authMethod,
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

router.get("/projects", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    await withOrganizationContext(user.organizationId, async () => {
      const projects = await listJiraProjects();
      res.json({ projects });
    });
  } catch (err) {
    next(normalizePipelineError(err));
  }
});

router.get("/boards", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    const projectKey =
      typeof req.query.projectKey === "string" ? req.query.projectKey : undefined;

    await withOrganizationContext(user.organizationId, async () => {
      const boards = await listJiraBoards(projectKey);
      res.json({ boards });
    });
  } catch (err) {
    next(normalizePipelineError(err));
  }
});

router.get("/boards/columns", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    await withOrganizationContext(user.organizationId, async () => {
      const boardId =
        typeof req.query.boardId === "string" ? req.query.boardId.trim() : undefined;
      const columns = await getBoardColumnsOrdered(boardId);
      res.json({ columns });
    });
  } catch (err) {
    next(normalizePipelineError(err));
  }
});

router.put("/intake-column", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    await withOrganizationContext(user.organizationId, async () => {
      validatePipelineJiraConfig();
      const columnName = String(req.body?.columnName ?? "").trim();
      if (!columnName) {
        res.status(400).json({ error: "columnName is required" });
        return;
      }
      const columns = await getBoardColumnsOrdered();
      const statuses = resolveIntakeStatusesForColumn(columnName, columns);
      const boardId = req.body?.boardId ? String(req.body.boardId).trim() : undefined;

      const { saveOrganizationPipelineIntake } = await import(
        "../../organization/jiraConfigStore"
      );
      await saveOrganizationPipelineIntake(user.organizationId!, {
        boardId,
        columnName,
        statuses,
      });

      const intake = getPipelineIntakeMapping();
      res.json(intake);
    });
  } catch (err) {
    next(normalizePipelineError(err));
  }
});

router.put("/reference-columns", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    await withOrganizationContext(user.organizationId, async () => {
      validatePipelineJiraConfig();
      const columnNames = Array.isArray(req.body?.columnNames)
        ? req.body.columnNames.map((name: unknown) => String(name).trim()).filter(Boolean)
        : [];
      const columns = await getBoardColumnsOrdered();
      const statuses = resolveReferenceStatusesForColumns(columnNames, columns);

      const { saveOrganizationReferenceColumns } = await import(
        "../../organization/jiraConfigStore"
      );
      await saveOrganizationReferenceColumns(user.organizationId!, {
        columnNames,
        statuses,
      });

      const { syncReferenceColumnTickets } = await import(
        "../../jira-sync/referenceSyncService"
      );
      const syncResult = await syncReferenceColumnTickets().catch((err) => {
        logger.warn({ err }, "reference column sync after save failed");
        return null;
      });

      const intake = getPipelineIntakeMapping();
      res.json({ intake, sync: syncResult });
    });
  } catch (err) {
    next(normalizePipelineError(err));
  }
});

router.post("/reference-columns/sync", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    await withOrganizationContext(user.organizationId, async () => {
      validatePipelineJiraConfig();
      const intake = getPipelineIntakeMapping();
      if (!intake.referenceStatuses.length) {
        res.status(400).json({
          error: "reference_columns_not_configured",
          message:
            "Select reference columns (Done, Resolved, etc.) and save before indexing Jira vectors.",
        });
        return;
      }

      const { syncReferenceColumnTickets } = await import(
        "../../jira-sync/referenceSyncService"
      );
      const syncResult = await syncReferenceColumnTickets();
      res.json({ intake, sync: syncResult });
    });
  } catch (err) {
    next(normalizePipelineError(err));
  }
});

router.get("/intake/tickets", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    await withOrganizationContext(user.organizationId, async () => {
      validatePipelineJiraConfig();
      const result = await listIntakeColumnTickets();
      res.json(result);
    });
  } catch (err) {
    next(normalizePipelineError(err));
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
    attachEngineeringComment: req.body?.attachEngineeringComment,
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
    next(normalizePipelineError(err));
  }
});

router.get("/mirror/stats", async (_req, res, next) => {
  try {
    const stats = await getMirrorStats();
    res.json(stats);
  } catch (err) {
    next(normalizePipelineError(err));
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
    next(normalizePipelineError(err));
  }
});

export default router;
