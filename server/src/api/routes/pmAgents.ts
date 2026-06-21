import { Router, type Request } from "express";
import { getTechAgentHandoff } from "../../agents/pm/handoff";
import {
  confirmVirinSolution,
  getPmResumeStage,
  runVirinPostShip,
  runPmAnalysisPipeline,
  runPmRetrospective,
  submitVirinAnswer,
  estimateAnalysisCost,
} from "../../agents/pm/orchestrator";
import { buildProductPackageExport } from "../../pipeline/artifacts";
import { prepareTechAgentHandoff } from "../../agents/tech/orchestrator";
import { pmAnalysisStore } from "../../agents/pm/store";
import { buildPmAnalysisListItems, buildPrdSummary } from "../../agents/pm/pmAnalysisCatalog";
import { startEngineeringHandoff } from "../../agents/pm/startEngineeringHandoff";
import type { PmAnalysisListFilter } from "../../agents/pm/handoffStatus";
import type { PmStageId, PmTicketInput, RetrospectiveInput } from "../../agents/pm/types";
import { getPipelineQueueState } from "../../queue/inProcessRunner";
import { resolveUserFromAuthHeader } from "./authSession";
import { requireOrganizationUser, withOrganizationContext } from "../orgRequestContext";
import { NotFoundError, ValidationError } from "../../utils/errors";

import {
  isPmAnalysisRunning,
  startPmAnalysisInBackground,
} from "../../agents/pm/backgroundRunner";

const router = Router();

function backgroundOrgFromRequest(req: Request): string | undefined {
  return resolveUserFromAuthHeader(req)?.organizationId ?? undefined;
}

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

router.get("/analyses", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    await withOrganizationContext(user.organizationId, async () => {
      const filter = (req.query.filter as PmAnalysisListFilter | undefined) ?? "all";
      const limit = Math.min(Number(req.query.limit) || 100, 200);
      const items = await buildPmAnalysisListItems(user.organizationId!, { limit, filter });
      res.json({ items });
    });
  } catch (err) {
    next(err);
  }
});

router.get("/prds/:ticketId/summary", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    await withOrganizationContext(user.organizationId, async () => {
      const jiraKey = req.params.ticketId.trim().toUpperCase();
      const summary = await buildPrdSummary(user.organizationId!, jiraKey);
      if (!summary) throw new NotFoundError("PRD not found for this ticket");
      res.json(summary);
    });
  } catch (err) {
    next(err);
  }
});

router.get("/analysis/:ticketId", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    await withOrganizationContext(user.organizationId, async () => {
      const record = pmAnalysisStore.get(req.params.ticketId);
      if (!record) throw new NotFoundError("PM analysis not found");
      res.json({
        ...record,
        costUsd: estimateAnalysisCost(record),
      });
    });
  } catch (err) {
    next(err);
  }
});

router.post("/analyze/:ticketId/resume", async (req, res, next) => {
  try {
    const jiraKey = req.params.ticketId.trim().toUpperCase();
    if (!jiraKey) throw new ValidationError("ticketId is required");

    const existing = pmAnalysisStore.get(jiraKey);
    if (!existing) {
      throw new NotFoundError("PM analysis not found");
    }
    if (existing.status === "RUNNING" || isPmAnalysisRunning(jiraKey)) {
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

    startPmAnalysisInBackground(
      jiraKey,
      () => runPmAnalysisPipeline({ jiraKey, resumeFrom }),
      { organizationId: backgroundOrgFromRequest(req) }
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

    startPmAnalysisInBackground(
      jiraKey,
      () => submitVirinAnswer(jiraKey, answer),
      { organizationId: backgroundOrgFromRequest(req) }
    );

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

    startPmAnalysisInBackground(
      jiraKey,
      () => confirmVirinSolution(jiraKey, confirmed, feedback),
      { organizationId: backgroundOrgFromRequest(req) }
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
    if (existing?.status === "RUNNING" || isPmAnalysisRunning(jiraKey)) {
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
    startPmAnalysisInBackground(
      jiraKey,
      () =>
        runPmAnalysisPipeline({
          jiraKey,
          ticket: body?.ticket,
          mode: body?.mode ?? "interactive",
        }),
      { organizationId: backgroundOrgFromRequest(req) }
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
    const user = resolveUserFromAuthHeader(req);
    if (!user?.organizationId) {
      res.status(403).json({ error: "organization_required" });
      return;
    }

    await withOrganizationContext(user.organizationId, async () => {
      const jiraKey = req.params.ticketId.trim().toUpperCase();
      if (!jiraKey) throw new ValidationError("ticketId is required");

      const record = pmAnalysisStore.get(jiraKey);
      if (record && record.status !== "COMPLETED") {
        throw new ValidationError(
          "PM analysis must be completed before starting the coding pipeline"
        );
      }

      const result = await startEngineeringHandoff(jiraKey, user.organizationId!);

      res.status(202).json({
        jiraKey,
        pipelineId: result.pipelineId,
        status: result.started ? "started" : result.enqueued > 0 ? "queued" : "skipped",
        message: result.message,
        pmContextAttached: Boolean(record?.generatedPrd),
        engineeringHandoff: pmAnalysisStore.get(jiraKey)?.engineeringHandoff ?? null,
        intake: {
          enqueued: result.enqueued,
          skipped: result.skipped,
          started: result.started,
        },
        queue: await getPipelineQueueState(user.organizationId!),
      });
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
