import { Router, type Request } from "express";
import { intakeConfig, validateJiraConfig } from "../../jira-intake/config";
import { searchBoardByKeyword } from "../../jira-intake/boardSearchService";
import {
  advanceIssueToNextColumn,
  applyColumnMappingFromSelection,
  getBoardColumnsOrdered,
  syncWorkingColumnFromBoard,
} from "../../jira-intake/boardColumnsService";
import { handleAiWorkerWebhook } from "../../jira-intake/aiWorkerWebhookHandler";
import { getIntegrationMapping } from "../../jira-intake/integrationConfigStore";
import {
  getQueueStats,
  listAiWorkerIssues,
  rowToApi,
} from "../../jira-intake/sqliteStore";
import { getLastWebhook } from "../../jira-intake/webhookDebug";

const router = Router();

const VALID_SEARCH_IN = new Set(["description", "summary", "both"]);

router.get("/health", (_req, res) => {
  res.json({ ok: true });
});

function publicApiBase(req: Request): string {
  if (process.env.PUBLIC_API_URL?.trim()) {
    return process.env.PUBLIC_API_URL.replace(/\/$/, "");
  }
  const proto = req.header("x-forwarded-proto") || req.protocol || "https";
  const host = req.header("x-forwarded-host") || req.get("host") || "localhost:4000";
  return `${proto}://${host}`;
}

router.get("/integration/setup", (req, res) => {
  const base = publicApiBase(req);
  const mapping = getIntegrationMapping();
  let jiraReady = false;
  try {
    validateJiraConfig();
    jiraReady = true;
  } catch {
    jiraReady = false;
  }
  res.json({
    publicApiBase: base,
    webhookUrl: `${base}/webhooks/jira`,
    webhookEvents: ["jira:issue_updated", "jira:issue_created"],
    webhookHint:
      "In Jira → Settings → Webhooks, paste the URL above. Enable Issue updated so moves between columns sync the AI Worker queue.",
    mapping,
    trackedStatuses: mapping.workingStatuses,
    jiraConfigured: jiraReady,
    boardId: intakeConfig.jira.boardId || null,
  });
});

router.get("/boards/columns", async (_req, res) => {
  try {
    const columns = await getBoardColumnsOrdered();
    res.json({ columns });
  } catch (err) {
    const e = err as Error & { status?: number };
    res.status(e.status && e.status >= 400 ? e.status : 502).json({ error: e.message });
  }
});

router.put("/integration/mapping", async (req, res) => {
  const workingColumnName = String(req.body?.workingColumnName ?? "").trim();
  const nextColumnName = String(req.body?.nextColumnName ?? "").trim();
  if (!workingColumnName || !nextColumnName) {
    res.status(400).json({
      error: "workingColumnName and nextColumnName are required",
    });
    return;
  }
  try {
    const columns = await getBoardColumnsOrdered();
    const mapping = applyColumnMappingFromSelection({
      workingColumnName,
      nextColumnName,
      columns,
    });
    res.json(mapping);
  } catch (err) {
    const e = err as Error & { status?: number };
    res.status(e.status && e.status >= 400 ? e.status : 502).json({ error: e.message });
  }
});

router.get("/integration/mapping", (_req, res) => {
  res.json(getIntegrationMapping());
});

router.post("/ai-worker/sync", async (_req, res) => {
  try {
    const result = await syncWorkingColumnFromBoard();
    res.json(result);
  } catch (err) {
    const e = err as Error & { status?: number };
    res.status(e.status && e.status >= 400 ? e.status : 502).json({ error: e.message });
  }
});

router.post("/ai-worker/issues/:issueKey/advance", async (req, res) => {
  try {
    const result = await advanceIssueToNextColumn(req.params.issueKey);
    res.json(result);
  } catch (err) {
    const e = err as Error & { status?: number };
    res.status(e.status && e.status >= 400 ? e.status : 502).json({ error: e.message });
  }
});

router.get("/ai-worker/config", (_req, res) => {
  const mapping = getIntegrationMapping();
  res.json({
    trackedStatuses: mapping.workingStatuses,
    workingColumnName: mapping.workingColumnName,
    nextColumnName: mapping.nextColumnName,
    hint: "Webhook must send issue.fields.status.name matching working column statuses.",
  });
});

router.get("/ai-worker/stats", (_req, res) => {
  const stats = getQueueStats();
  const last = getLastWebhook();
  res.json({ ...stats, lastWebhook: last });
});

router.get("/ai-worker/debug/last-webhook", (_req, res) => {
  const last = getLastWebhook();
  const stats = getQueueStats();
  res.json({
    last,
    stats,
    message: last
      ? "Jira reached your server."
      : stats.active > 0
        ? "Queue has tickets; last webhook was before server restart."
        : "No webhook received yet. Check Jira webhook URL and ngrok.",
  });
});

router.get("/ai-worker/issues", (req, res) => {
  const { active } = req.query;
  const rows = listAiWorkerIssues(active as string | undefined);
  res.json({
    count: rows.length,
    items: rows.map(rowToApi),
  });
});

router.get("/boards/search", async (req, res) => {
  const keyword = String(req.query.keyword || "").trim();
  const searchIn = String(req.query.searchIn || "description").toLowerCase();

  if (!keyword) {
    res.status(400).json({ error: "Query parameter 'keyword' is required" });
    return;
  }

  if (!VALID_SEARCH_IN.has(searchIn)) {
    res.status(400).json({
      error: "searchIn must be one of: description, summary, both",
    });
    return;
  }

  try {
    const result = await searchBoardByKeyword(keyword, searchIn);
    res.json(result);
  } catch (err) {
    const e = err as Error & { status?: number; body?: unknown };
    const status = e.status && e.status >= 400 ? e.status : 502;
    res.status(status).json({
      error: e.message,
      details: e.body || undefined,
    });
  }
});

router.get("/webhooks/jira/ai-worker", (_req, res) => {
  res.json({
    ok: true,
    message: "Jira AI Worker intake webhook. Use POST with Jira issue JSON.",
    trackedStatuses: intakeConfig.aiWorkerStatuses,
    legacyPath: "/webhooks/jira",
  });
});

router.post("/webhooks/jira/ai-worker", (req, res) => {
  handleAiWorkerWebhook(req, res);
});

export default router;
