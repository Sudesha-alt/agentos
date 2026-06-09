import { Router } from "express";
import { validatePipelineJiraConfig } from "../../pipeline/jira/credentialsStore";
import { getJiraSyncConfig } from "../../jira-sync/config";
import {
  getJiraIssueByKey,
  getJiraIssueStats,
  listJiraIssues,
} from "../../jira-sync/issueRepository";
import {
  getLatestSyncRun,
  isJiraSyncRunning,
} from "../../jira-sync/syncService";
import { runJiraSyncInBackground } from "../../queue/inProcessRunner";
import { embedSyncedIssue } from "../../jira-sync/embedder";
import { fetchJiraIssueByKey } from "../../jira-sync/issueFetcher";
import { NotFoundError } from "../../utils/errors";

const router = Router();

router.get("/status", async (_req, res, next) => {
  try {
    let connected = false;
    try {
      validatePipelineJiraConfig();
      connected = true;
    } catch {
      connected = false;
    }

    const [stats, latestRun] = await Promise.all([
      getJiraIssueStats(),
      getLatestSyncRun(),
    ]);

    res.json({
      connected,
      running: isJiraSyncRunning(),
      config: getJiraSyncConfig(),
      stats,
      latestRun,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/issues", async (req, res, next) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const project = typeof req.query.project === "string" ? req.query.project : undefined;
    const q = typeof req.query.q === "string" ? req.query.q : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const offset = req.query.offset ? Number(req.query.offset) : undefined;

    const result = await listJiraIssues({ status, project, q, limit, offset });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/issues/:jiraKey", async (req, res, next) => {
  try {
    const jiraKey = req.params.jiraKey.trim().toUpperCase();
    const issue = await getJiraIssueByKey(jiraKey);
    if (!issue) throw new NotFoundError("Synced Jira issue not found");
    res.json(issue);
  } catch (err) {
    next(err);
  }
});

router.post("/run", async (req, res, next) => {
  try {
    validatePipelineJiraConfig();
    const mode = req.body?.mode === "incremental" ? "incremental" : "full";
    const projectKeys = Array.isArray(req.body?.projectKeys)
      ? req.body.projectKeys.map(String)
      : undefined;

    if (isJiraSyncRunning()) {
      res.status(202).json({
        status: "RUNNING",
        message: "Jira sync already in progress",
      });
      return;
    }

    const { started } = runJiraSyncInBackground({ mode, projectKeys });
    res.status(202).json({
      status: started ? "STARTED" : "BUSY",
      mode,
      message: started
        ? `Jira ${mode} sync started in background`
        : "Jira sync could not start",
    });
  } catch (err) {
    next(err);
  }
});

router.post("/embed", async (req, res, next) => {
  try {
    validatePipelineJiraConfig();
    const jiraKey = req.body?.jiraKey
      ? String(req.body.jiraKey).trim().toUpperCase()
      : null;

    if (jiraKey) {
      const fetched = await fetchJiraIssueByKey(jiraKey);
      if (!fetched) throw new NotFoundError("Jira issue not found");
      const embedded = await embedSyncedIssue(fetched);
      res.json({ jiraKey, embedded });
      return;
    }

    const limit = Math.min(Number(req.body?.limit ?? 50), 200);
    const { items } = await listJiraIssues({ limit, offset: 0 });
    let embedded = 0;
    for (const row of items) {
      const fetched = await fetchJiraIssueByKey(row.jiraKey);
      if (!fetched) continue;
      const ok = await embedSyncedIssue(fetched);
      if (ok) embedded += 1;
    }
    res.json({ embedded, processed: items.length });
  } catch (err) {
    next(err);
  }
});

export default router;
