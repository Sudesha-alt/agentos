import { Router, type Request } from "express";
import {
  connectPipelineJira,
  ensurePipelineJiraWebhook,
  pipelineJiraPublicBase,
  pipelineJiraWebhookUrl,
} from "../../pipeline/jira/connectPipelineJira";
import {
  getPublicPipelineJiraCredentials,
  validatePipelineJiraConfig,
} from "../../pipeline/jira/credentialsStore";
import { getPipelineJiraMirrorConfig } from "../../pipeline/jira/config";
import { buildMirrorBackfillJql } from "../../pipeline/jira/mirror/jql";
import {
  getMirrorStats,
  runMirrorBackfill,
} from "../../pipeline/jira/mirror/syncService";
import { jobQueue, JOB_NAMES } from "../../queue/jobQueue";

const router = Router();

router.get("/setup", (req, res) => {
  const jira = getPublicPipelineJiraCredentials();
  let connected = false;
  try {
    validatePipelineJiraConfig();
    connected = true;
  } catch {
    connected = false;
  }

  res.json({
    publicApiBase: pipelineJiraPublicBase(req),
    webhookUrl: pipelineJiraWebhookUrl(req),
    webhookEvents: ["jira:issue_created", "jira:issue_updated"],
    webhookHint:
      "Lane 2 pipeline webhook. issue_created starts the agent pipeline; issue_updated syncs closed/done tickets into the mirror for RAG.",
    mirror: getPipelineJiraMirrorConfig(),
    mirrorJql: connected
      ? buildMirrorBackfillJql(jira.projectKeys)
      : null,
    jira,
    connected,
  });
});

router.post("/connect", async (req, res) => {
  const baseUrl = String(req.body?.baseUrl ?? "").trim();
  const email = String(req.body?.email ?? "").trim();
  const apiToken = req.body?.apiToken
    ? String(req.body.apiToken).trim()
    : undefined;
  const webhookSecret = req.body?.webhookSecret
    ? String(req.body.webhookSecret).trim()
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

  const prior = getPublicPipelineJiraCredentials();
  if (!apiToken && !prior.hasApiToken) {
    res.status(400).json({ error: "apiToken is required on first connect" });
    return;
  }

  try {
    const webhookUrl = pipelineJiraWebhookUrl(req);
    const result = await connectPipelineJira({
      baseUrl,
      email: email || undefined,
      apiToken,
      webhookSecret,
      projectKeys,
      webhookUrl,
      autoRegisterWebhook: req.body?.autoRegisterWebhook !== false,
    });
    res.json({
      ...result,
      publicApiBase: pipelineJiraPublicBase(req),
      webhookUrl,
    });
  } catch (err) {
    const e = err as Error;
    res.status(502).json({ error: e.message });
  }
});

router.post("/webhook/register", async (req, res) => {
  const jira = getPublicPipelineJiraCredentials();
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
    validatePipelineJiraConfig();
    const projectKeys = Array.isArray(req.body?.projectKeys)
      ? req.body.projectKeys.map(String)
      : undefined;
    const maxIssues = req.body?.maxIssues
      ? Number(req.body.maxIssues)
      : undefined;
    const async = req.body?.async !== false;

    if (async) {
      const job = await jobQueue.add(JOB_NAMES.RUN_JIRA_MIRROR_BACKFILL, {
        projectKeys,
        maxIssues,
      });
      res.status(202).json({ jobId: job.id, status: "queued" });
      return;
    }

    const result = await runMirrorBackfill({ projectKeys, maxIssues });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
