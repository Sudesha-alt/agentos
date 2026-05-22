import { Router } from "express";
import { intakeConfig } from "../../jira-intake/config";
import { searchBoardByKeyword } from "../../jira-intake/boardSearchService";
import { handleAiWorkerWebhook } from "../../jira-intake/aiWorkerWebhookHandler";
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

router.get("/ai-worker/config", (_req, res) => {
  res.json({
    trackedStatuses: intakeConfig.aiWorkerStatuses,
    hint: "Webhook must send issue.fields.status.name matching one of these (case-insensitive).",
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
