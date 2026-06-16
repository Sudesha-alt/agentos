import { Router } from "express";
import { prisma } from "../../db/client";
import { canaryRunRepo } from "../../db/repositories/canaryRunRepo";
import type { QaOutput } from "../../types/agents";

const router = Router();

router.get("/pipeline-reports", async (_req, res, next) => {
  try {
    const stages = await prisma.pipelineStageLog.findMany({
      where: { stage: "QA_AGENT", status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      take: 50,
      include: {
        pipeline: { include: { ticket: true } },
      },
    });

    res.json({
      reports: stages.map((s) => {
        const out = s.output as {
          qa?: QaOutput;
          executionReport?: { testRun?: { passed?: number; failed?: number; totalTests?: number } };
        } | null;
        const qa = out?.qa;
        const total = qa?.testCases?.length ?? 0;
        const testRun = out?.executionReport?.testRun;
        let passRate = 0;
        if (testRun && (testRun.totalTests ?? 0) > 0) {
          passRate = Math.round(((testRun.passed ?? 0) / testRun.totalTests!) * 100);
        } else if (total > 0) {
          passRate = 100;
        }
        return {
          pipelineId: s.pipelineId,
          jiraKey: s.pipeline.ticket.jiraKey,
          ticketId: s.pipeline.ticketId,
          testCount: total,
          passRate,
          completedAt: s.completedAt?.toISOString(),
          testSummary: qa?.testSummary,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/pipeline-reports/:pipelineId", async (req, res, next) => {
  try {
    const stage = await prisma.pipelineStageLog.findFirst({
      where: {
        pipelineId: req.params.pipelineId,
        stage: "QA_AGENT",
        status: "COMPLETED",
      },
      orderBy: { completedAt: "desc" },
      include: { pipeline: { include: { ticket: true } } },
    });
    if (!stage) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    const out = stage.output as {
      qa?: QaOutput;
      executionReport?: Record<string, unknown>;
      toolCallLog?: unknown[];
    } | null;
    res.json({
      pipelineId: stage.pipelineId,
      jiraKey: stage.pipeline.ticket.jiraKey,
      ticketId: stage.pipeline.ticketId,
      testCases: out?.qa?.testCases ?? [],
      executionReport: out?.executionReport,
      testSummary: out?.qa?.testSummary,
      completedAt: stage.completedAt?.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/coverage", (_req, res) => {
  res.json({
    files: [
      { path: "server/src/pipeline/orchestrator.ts", coverage: 72, lines: 68, branches: 64 },
      { path: "server/src/qaAgent/index.ts", coverage: 81, lines: 78, branches: 70 },
      { path: "app/src/app/pages/QaCenter.jsx", coverage: 55, lines: 52, branches: 48 },
    ],
  });
});

router.get("/heatmap", (_req, res) => {
  res.json({
    criteria: ["auth", "validation", "pagination", "concurrency"],
    features: ["checkout", "subscriptions", "exports"],
    cells: [
      ["pass", "warn", "na", "fail"],
      ["pass", "pass", "warn", "na"],
      ["pass", "na", "pass", "warn"],
    ],
  });
});

router.get("/failures", (_req, res) => {
  res.json({
    columns: [
      {
        id: "unit",
        label: "Unit",
        items: [],
      },
      {
        id: "integration",
        label: "Integration",
        items: [],
      },
    ],
  });
});

router.get("/reports", async (_req, res, next) => {
  try {
    const runs = await canaryRunRepo.listRecent(10);
    res.json({
      reports: runs.map((run) => ({
        ticketId: run.jiraKey ?? run.id,
        passRate: run.findings.length === 0 ? 100 : Math.max(0, 100 - run.findings.length * 5),
        recommendation: run.findings.some((f) => f.severity === "critical")
          ? "block_release"
          : "proceed_with_caution",
        canaryRunId: run.id,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/reports/:ticketId", async (req, res, next) => {
  try {
    const runs = await canaryRunRepo.listRecent(50);
    const run =
      runs.find((r) => r.jiraKey === req.params.ticketId) ??
      runs.find((r) => r.id === req.params.ticketId);
    if (!run) {
      res.status(404).json({ error: "not_found" });
      return;
    }
    res.json({
      ticketId: run.jiraKey ?? run.id,
      summary: run.summary,
      findings: run.findings,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
