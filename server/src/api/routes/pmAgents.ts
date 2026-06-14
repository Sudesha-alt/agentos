import { Router } from "express";
import { getTechAgentHandoff } from "../../agents/pm/handoff";
import { buildPmPipelineContext } from "../../agents/pm/pmPipelineContext";
import {
  confirmVirinSolution,
  getPmResumeStage,
  runVirinPostShip,
  runPmAnalysisPipeline,
  runPmRetrospective,
  submitVirinAnswer,
  estimateAnalysisCost,
} from "../../agents/pm/orchestrator";
import { mirrorPmArtifactsToPipeline, buildProductPackageExport } from "../../pipeline/artifacts";
import { enqueueIntakeFromJiraKey } from "../../pipeline/jira/intakeEnqueueService";
import { prepareTechAgentHandoff } from "../../agents/tech/orchestrator";
import { pmAnalysisStore } from "../../agents/pm/store";
import type { PmStageId, PmTicketInput, RetrospectiveInput } from "../../agents/pm/types";
import { getPipelineQueueState } from "../../queue/inProcessRunner";
import { NotFoundError, ValidationError } from "../../utils/errors";

const router = Router();
const running = new Set<string>();

router.get("/analysis/:ticketId/export", (req, res, next) => {
  try {
    const record = pmAnalysisStore.get(req.params.ticketId);
    if (!record) throw new NotFoundError("PM analysis not found");
    if (!record.generatedPrd) {
      throw new ValidationError("PRD not generated — complete Virin analysis first");
    }
    res.json(buildProductPackageExport(record));
  } catch (err) {
    next(err);
  }
});

router.get("/analyses", (_req, res) => {
  const items = pmAnalysisStore.list(50).map((r) => ({
    id: r.id,
    jiraKey: r.jiraKey,
    status: r.status,
    currentStage: r.currentStage,
    summary: r.ticketInput.summary,
    agent: r.agentName ?? "Virin",
    ticketType: r.neelIntake?.ticketType ?? r.classification?.type ?? null,
    recommendation: r.prioritization?.recommendation ?? r.solutioning?.recommendedApproach?.slice(0, 80) ?? null,
    severity: r.classification?.severity ?? null,
    awaiting: r.status === "AWAITING_INPUT" || r.status === "AWAITING_CONFIRMATION",
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

function startPmAnalysisBackground(
  jiraKey: string,
  run: () => Promise<unknown>
): void {
  running.add(jiraKey);
  void run()
    .catch(() => {
      /* errors stored on record */
    })
    .finally(() => {
      running.delete(jiraKey);
    });
}

router.post("/analyze/:ticketId/resume", async (req, res, next) => {
  try {
    const jiraKey = req.params.ticketId.trim().toUpperCase();
    if (!jiraKey) throw new ValidationError("ticketId is required");

    const existing = pmAnalysisStore.get(jiraKey);
    if (!existing) {
      throw new NotFoundError("PM analysis not found");
    }
    if (existing.status === "RUNNING" || running.has(jiraKey)) {
      res.status(202).json({
        jiraKey,
        status: "RUNNING",
        message: "Analysis already in progress",
        analysisId: existing.id,
      });
      return;
    }
    if (existing.status !== "FAILED") {
      throw new ValidationError("Only failed analyses can be resumed");
    }

    const resumeFrom = (req.body?.resumeFrom as PmStageId | undefined) ?? getPmResumeStage(existing);
    if (!resumeFrom) {
      throw new ValidationError("Could not determine which stage to resume from");
    }

    startPmAnalysisBackground(jiraKey, () =>
      runPmAnalysisPipeline({ jiraKey, resumeFrom })
    );

    res.status(202).json({
      jiraKey,
      status: "RUNNING",
      resumeFrom,
      message: `PM analysis resumed from ${resumeFrom}`,
    });
  } catch (err) {
    next(err);
  }
});

router.post("/analyze/:ticketId/answer", async (req, res, next) => {
  try {
    const jiraKey = req.params.ticketId.trim().toUpperCase();
    const answer = String(req.body?.answer ?? "").trim();
    if (!answer) throw new ValidationError("answer is required");

    startPmAnalysisBackground(jiraKey, () => submitVirinAnswer(jiraKey, answer));

    res.status(202).json({
      jiraKey,
      status: "RUNNING",
      message: "Virin continued with your answer",
    });
  } catch (err) {
    next(err);
  }
});

router.post("/analyze/:ticketId/confirm", async (req, res, next) => {
  try {
    const jiraKey = req.params.ticketId.trim().toUpperCase();
    const confirmed = req.body?.confirmed !== false;
    const feedback = req.body?.feedback ? String(req.body.feedback) : undefined;

    startPmAnalysisBackground(jiraKey, () =>
      confirmVirinSolution(jiraKey, confirmed, feedback)
    );

    res.status(202).json({
      jiraKey,
      status: confirmed ? "RUNNING" : "RUNNING",
      message: confirmed
        ? "Direction confirmed — Virin is writing the PRD"
        : "Direction rejected — Virin is revising the approach",
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
        message: "Virin is already working on this ticket",
        analysisId: existing?.id,
      });
      return;
    }

    const body = req.body as {
      ticket?: Partial<PmTicketInput>;
      mode?: "interactive" | "auto";
    } | undefined;
    startPmAnalysisBackground(jiraKey, () =>
      runPmAnalysisPipeline({
        jiraKey,
        ticket: body?.ticket,
        mode: body?.mode ?? "interactive",
      })
    );

    res.status(202).json({
      jiraKey,
      status: "RUNNING",
      message: "Virin started product discovery",
      agent: "Virin",
    });
  } catch (err) {
    next(err);
  }
});

router.post("/post-ship/:ticketId", async (req, res, next) => {
  try {
    const jiraKey = req.params.ticketId.trim().toUpperCase();
    const body = (req.body ?? {}) as RetrospectiveInput;
    const record = await runVirinPostShip({
      jiraKey,
      metricsInput: body.metricsInput,
      launchNotes: body.launchNotes,
    });
    res.json({
      jiraKey,
      postShip: record.postShip,
      costUsd: estimateAnalysisCost(record),
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

router.post("/handoff/:ticketId/start-pipeline", async (req, res, next) => {
  try {
    const jiraKey = req.params.ticketId.trim().toUpperCase();
    if (!jiraKey) throw new ValidationError("ticketId is required");

    const record = pmAnalysisStore.get(jiraKey);
    if (record && record.status !== "COMPLETED") {
      throw new ValidationError(
        "PM analysis must be completed before starting the coding pipeline"
      );
    }

    const handoff =
      record?.status === "COMPLETED"
        ? await prepareTechAgentHandoff(jiraKey)
        : null;

    const pmContext =
      record?.generatedPrd && record.status === "COMPLETED"
        ? buildPmPipelineContext(record)
        : undefined;

    const intake = await enqueueIntakeFromJiraKey(jiraKey, undefined, pmContext);

    res.status(202).json({
      jiraKey,
      status: "started",
      message:
        intake.enqueued > 0
          ? pmContext
            ? "Coding pipeline enqueued with PM PRD (discovery skipped)"
            : handoff
              ? "Coding pipeline enqueued from PM handoff"
              : "Coding pipeline enqueued from Jira ticket (PM handoff unavailable — re-run analysis to attach PM context)"
          : "Ticket already active or queued — check pipeline queue",
      pmContextAttached: Boolean(pmContext),
      handoff: handoff
        ? {
            recommendation: handoff.handoff.recommendation,
            suggestedFirstFile: handoff.handoff.suggestedFirstFile,
          }
        : null,
      intake,
      queue: getPipelineQueueState(),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/retrospective/:ticketId", async (req, res, next) => {
  try {
    const jiraKey = req.params.ticketId.trim().toUpperCase();
    const body = (req.body ?? {}) as RetrospectiveInput;

    const record = await runPmRetrospective({
      jiraKey,
      humanFeedback: body.overrideReason ?? body.humanDecision,
    });
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
