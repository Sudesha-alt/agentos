import type { Request, Response } from "express";
import { intakeConfig } from "./config";
import { isAiWorkerStatus } from "./aiWorkerFilter";
import { getTrackedWorkingStatuses } from "./integrationConfigStore";
import { parseJiraWebhook } from "./jiraEventParser";
import {
  deactivateAiWorkerIssue,
  upsertAiWorkerIssue,
} from "./sqliteStore";
import { recordWebhook } from "./webhookDebug";
import { logger } from "../utils/logger";

function intakeLog(
  level: "error" | "warn" | "info" | "debug",
  msg: string,
  meta: Record<string, unknown> = {}
): void {
  const levels = { error: 0, warn: 1, info: 2, debug: 3 };
  const current = levels[intakeConfig.logLevel as keyof typeof levels] ?? 2;
  if ((levels[level] ?? 2) <= current) {
    logger[level](meta, msg);
  }
}

/** AI Worker column intake — same behavior as the standalone Jira Webhook service. */
export function handleAiWorkerWebhook(req: Request, res: Response): void {
  try {
    const parsed = parseJiraWebhook(req.body);
    if (!parsed) {
      recordWebhook(
        req.body as { webhookEvent?: string } | null,
        null,
        "ignored"
      );
      intakeLog("warn", "ai-worker webhook ignored: no issue in payload");
      res.status(200).json({ ok: true, action: "ignored" });
      return;
    }

    const inAiWorker = isAiWorkerStatus(
      parsed.statusName,
      getTrackedWorkingStatuses()
    );

    if (inAiWorker) {
      recordWebhook(
        req.body as { webhookEvent?: string },
        parsed,
        "upserted"
      );
      upsertAiWorkerIssue(parsed);
      intakeLog("info", "ai worker issue upserted", {
        issueKey: parsed.issueKey,
        status: parsed.statusName,
      });
      res
        .status(200)
        .json({ ok: true, action: "upserted", issueKey: parsed.issueKey });
      return;
    }

    recordWebhook(req.body as { webhookEvent?: string }, parsed, "deactivated");
    deactivateAiWorkerIssue(parsed.issueKey);
    intakeLog("info", "ai worker issue deactivated", {
      issueKey: parsed.issueKey,
      status: parsed.statusName,
    });
    res
      .status(200)
      .json({ ok: true, action: "deactivated", issueKey: parsed.issueKey });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    intakeLog("error", "ai-worker webhook processing failed", { error: message });
    res.status(500).json({ ok: false, error: message });
  }
}
