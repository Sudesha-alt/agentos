import { Router } from "express";
import { runCanaryCycle } from "../../canaryAgent";
import { canaryRunRepo } from "../../db/repositories/canaryRunRepo";
import { runCanaryInBackground } from "../../queue/inProcessRunner";

const router = Router();

router.get("/runs", async (_req, res, next) => {
  try {
    const runs = await canaryRunRepo.listRecent(30);
    res.json({
      items: runs.map(mapRun),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/runs/:id", async (req, res, next) => {
  try {
    const run = await canaryRunRepo.getById(req.params.id);
    if (!run) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json(mapRun(run));
  } catch (err) {
    next(err);
  }
});

router.post("/run", async (req, res, next) => {
  try {
    const environment = String(req.body?.environment ?? "staging");
    const scope = String(req.body?.scope ?? "full");
    const async = req.body?.async !== false;
    const pipelineId = req.body?.pipelineId ? String(req.body.pipelineId) : undefined;
    const jiraKey = req.body?.jiraKey ? String(req.body.jiraKey) : undefined;
    const targetUrl = req.body?.targetUrl ? String(req.body.targetUrl) : undefined;

    const input = {
      pipelineId,
      jiraKey,
      trigger: "manual" as const,
      environment: environment as "staging" | "production" | "preview" | "feature_branch",
      scope: scope as "full" | "critical_paths" | "changed_files",
      targetUrl,
      orientation: req.body?.orientation,
    };

    if (async) {
      const { started, runId } = runCanaryInBackground(input);
      res.status(202).json({ status: started ? "started" : "already_running", runId });
      return;
    }

    const result = await runCanaryCycle(input);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get("/nightly-summary", async (_req, res, next) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const summary = await canaryRunRepo.nightlySummary(since);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

function mapRun(run: Awaited<ReturnType<typeof canaryRunRepo.getById>>) {
  if (!run) return null;
  return {
    id: run.id,
    pipelineId: run.pipelineId,
    jiraKey: run.jiraKey ?? run.pipeline?.ticket?.jiraKey,
    trigger: run.trigger,
    environment: run.environment,
    scope: run.scope,
    targetUrl: run.targetUrl,
    status: run.status,
    phase: run.phase,
    summary: run.summary,
    error: run.error,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    findingCount: run.findings.length,
    findings: run.findings.map((f) => ({
      id: f.id,
      hypothesisId: f.hypothesisId,
      severity: f.severity,
      category: f.category,
      title: f.title,
      description: f.description,
      reproductionSteps: f.reproductionSteps,
      affectedCode: f.affectedCode,
      suggestedFix: f.suggestedFix,
      evidence: f.evidence,
      createdAt: f.createdAt,
    })),
  };
}

export default router;
