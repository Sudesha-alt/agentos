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
import {
  requireOrganizationUser,
  withOrganizationContext,
} from "../orgRequestContext";

const router = Router();

router.get("/status", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    await withOrganizationContext(user.organizationId, async () => {
      let connected = false;
      try {
        validatePipelineJiraConfig();
        connected = true;
      } catch {
        connected = false;
      }

      const [stats, latestRun] = await Promise.all([
        getJiraIssueStats(user.organizationId),
        getLatestSyncRun(user.organizationId),
      ]);

      res.json({
        connected,
        running: isJiraSyncRunning(user.organizationId),
        config: getJiraSyncConfig(),
        stats,
        latestRun,
      });
    });
  } catch (err) {
    next(err);
  }
});

router.get("/issues", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    await withOrganizationContext(user.organizationId, async () => {
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const project = typeof req.query.project === "string" ? req.query.project : undefined;
      const q = typeof req.query.q === "string" ? req.query.q : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;
      const offset = req.query.offset ? Number(req.query.offset) : undefined;

      const result = await listJiraIssues({
        status,
        project,
        q,
        limit,
        offset,
        organizationId: user.organizationId,
      });
      res.json(result);
    });
  } catch (err) {
    next(err);
  }
});

router.get("/issues/:jiraKey", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    await withOrganizationContext(user.organizationId, async () => {
      const jiraKey = req.params.jiraKey.trim().toUpperCase();
      const issue = await getJiraIssueByKey(jiraKey, user.organizationId);
      if (!issue) throw new NotFoundError("Synced Jira issue not found");
      res.json(issue);
    });
  } catch (err) {
    next(err);
  }
});

router.post("/run", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    await withOrganizationContext(user.organizationId, async () => {
      validatePipelineJiraConfig();
      const mode = req.body?.mode === "incremental" ? "incremental" : "full";
      const projectKeys = Array.isArray(req.body?.projectKeys)
        ? req.body.projectKeys.map(String)
        : undefined;

      if (isJiraSyncRunning(user.organizationId)) {
        res.status(202).json({
          status: "RUNNING",
          message: "Jira sync already in progress",
        });
        return;
      }

      const { started } = runJiraSyncInBackground({
        mode,
        projectKeys,
        organizationId: user.organizationId!,
      });
      res.status(202).json({
        status: started ? "STARTED" : "BUSY",
        mode,
        message: started
          ? `Jira ${mode} sync started in background`
          : "Jira sync could not start",
      });
    });
  } catch (err) {
    next(err);
  }
});

router.post("/issues/:jiraKey/embed", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    await withOrganizationContext(user.organizationId, async () => {
      validatePipelineJiraConfig();
      const jiraKey = req.params.jiraKey.trim().toUpperCase();
      const issue = await fetchJiraIssueByKey(jiraKey);
      if (!issue) throw new NotFoundError("Jira issue not found");
      const embedded = await embedSyncedIssue(issue);
      res.json({ jiraKey, embedded });
    });
  } catch (err) {
    next(err);
  }
});

export default router;
