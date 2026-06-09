import { Router } from "express";
import { getTechAgentHandoff } from "../../agents/pm/handoff";
import {
  runPmAnalysisPipeline,
  runPmRetrospective,
  estimateAnalysisCost,
} from "../../agents/pm/orchestrator";
import { prepareTechAgentHandoff } from "../../agents/tech/orchestrator";
import { pmAnalysisStore } from "../../agents/pm/store";
import type { PmTicketInput, RetrospectiveInput } from "../../agents/pm/types";
import { NotFoundError, ValidationError } from "../../utils/errors";

const router = Router();
const running = new Set<string>();

router.get("/analyses", (_req, res) => {
  const items = pmAnalysisStore.list(50).map((r) => ({
    id: r.id,
    jiraKey: r.jiraKey,
    status: r.status,
    currentStage: r.currentStage,
    summary: r.ticketInput.summary,
    recommendation: r.prioritization?.recommendation ?? null,
    severity: r.classification?.severity ?? null,
    startedAt: r.startedAt,
    completedAt: r.completedAt ?? null,
    costUsd: estimateAnalysisCost(r),
  }));
  res.json({ items });
});

router.get("/analysis/:ticketId", (req, res, next) => {
  try {
    const record = pmAnalysisStore.get(req.params.ticketId);
    if (!record) throw new NotFoundError("PM analysis not found");
    res.json({
      ...record,
      costUsd: estimateAnalysisCost(record),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/analyze/:ticketId", async (req, res, next) => {
  try {
    const jiraKey = req.params.ticketId.trim().toUpperCase();
    if (!jiraKey) throw new ValidationError("ticketId is required");

    const existing = pmAnalysisStore.get(jiraKey);
    if (existing?.status === "RUNNING" || running.has(jiraKey)) {
      res.status(202).json({
        jiraKey,
        status: "RUNNING",
        message: "Analysis already in progress",
        analysisId: existing?.id,
      });
      return;
    }

    const body = req.body as { ticket?: Partial<PmTicketInput> } | undefined;
    running.add(jiraKey);

    // Run in background so client can poll
    void runPmAnalysisPipeline({ jiraKey, ticket: body?.ticket })
      .catch(() => {
        /* errors stored on record */
      })
      .finally(() => {
        running.delete(jiraKey);
      });

    res.status(202).json({
      jiraKey,
      status: "RUNNING",
      message: "PM analysis pipeline started",
    });
  } catch (err) {
    next(err);
  }
});

router.get("/handoff/:ticketId", async (req, res, next) => {
  try {
    const jiraKey = req.params.ticketId.trim().toUpperCase();
    if (!jiraKey) throw new ValidationError("ticketId is required");

    const result = await getTechAgentHandoff(jiraKey);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/handoff/:ticketId", async (req, res, next) => {
  try {
    const jiraKey = req.params.ticketId.trim().toUpperCase();
    if (!jiraKey) throw new ValidationError("ticketId is required");

    const result = await prepareTechAgentHandoff(jiraKey);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/retrospective/:ticketId", async (req, res, next) => {
  try {
    const jiraKey = req.params.ticketId.trim().toUpperCase();
    const body = (req.body ?? {}) as RetrospectiveInput;

    const record = await runPmRetrospective({ jiraKey, retrospective: body });
    res.json({
      jiraKey,
      retrospective: record.retrospective,
      costUsd: estimateAnalysisCost(record),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
