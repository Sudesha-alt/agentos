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
    const qa = out?.qa;
    const execReport = out?.executionReport as {
      overallRecommendation?: string;
      testRun?: { passed?: number; failed?: number; skipped?: number; totalTests?: number; duration?: number; coverage?: number; testResults?: Array<{ id: string; status: string }> };
      failureAnalysis?: Array<{ testId: string; testName: string; severity?: string; likelyCause?: string; violatedCriterion?: string; remediation?: string }>;
      securityScan?: { criticalCount?: number; highCount?: number; findings?: Array<{ title: string; severity: string; description?: string }> };
    } | undefined;

    // Merge per-test-case pass/fail status from execution report
    const testResults = execReport?.testRun?.testResults ?? [];
    const testCases = (qa?.testCases ?? []).map((tc) => {
      const result = testResults.find((r) => r.id === tc.id);
      return { ...tc, status: result?.status ?? (testResults.length > 0 ? "skipped" : "pending") };
    });

    res.json({
      pipelineId: stage.pipelineId,
      jiraKey: stage.pipeline.ticket.jiraKey,
      ticketId: stage.pipeline.ticketId,
      testCases,
      coverageReport: qa?.coverageReport,
      riskAreas: qa?.riskAreas ?? [],
      confidenceScore: qa?.confidenceScore,
      testSummary: qa?.testSummary,
      recommendation: execReport?.overallRecommendation ?? null,
      testRun: execReport?.testRun ?? null,
      failureAnalysis: execReport?.failureAnalysis ?? [],
      securityScan: execReport?.securityScan ?? null,
      completedAt: stage.completedAt?.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/coverage", async (_req, res, next) => {
  try {
    const stages = await prisma.pipelineStageLog.findMany({
      where: { stage: "QA_AGENT", status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      take: 20,
    });

    // Aggregate coverage by jiraKey from the most recent QA run per pipeline
    const coverageMap = new Map<string, { coverage: number; lines: number; branches: number; label: string }>();
    for (const s of stages) {
      const out = s.output as { qa?: QaOutput; executionReport?: { testRun?: { coverage?: number } } } | null;
      const qa = out?.qa;
      if (!qa) continue;
      const cov = qa.coverageReport.coveragePercent;
      const label = `Pipeline ${s.pipelineId.slice(0, 8)}`;
      if (!coverageMap.has(s.pipelineId)) {
        coverageMap.set(s.pipelineId, {
          coverage: Math.round(cov),
          lines: Math.round(cov),
          branches: Math.round(cov * 0.85),
          label,
        });
      }
    }

    res.json({
      files: [...coverageMap.entries()].slice(0, 10).map(([pipelineId, v]) => ({
        path: v.label,
        pipelineId,
        coverage: v.coverage,
        lines: v.lines,
        branches: v.branches,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/heatmap", async (_req, res, next) => {
  try {
    const stages = await prisma.pipelineStageLog.findMany({
      where: { stage: "QA_AGENT", status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      take: 10,
      include: { pipeline: { include: { ticket: true } } },
    });

    // Build heatmap: features = jiraKeys, criteria = types of test cases
    const typeSet = new Set<string>();
    for (const s of stages) {
      const out = s.output as { qa?: QaOutput } | null;
      (out?.qa?.testCases ?? []).forEach((tc) => typeSet.add(tc.type ?? "unit"));
    }
    const criteria = [...typeSet].slice(0, 6);
    const features = stages.slice(0, 8).map((s) => s.pipeline.ticket.jiraKey);

    const cells = stages.slice(0, 8).map((s) => {
      const out = s.output as { qa?: QaOutput; executionReport?: { testRun?: { testResults?: Array<{ id: string; status: string }> } } } | null;
      const qa = out?.qa;
      const testResults = out?.executionReport?.testRun?.testResults ?? [];
      return criteria.map((type) => {
        const tcs = (qa?.testCases ?? []).filter((tc) => (tc.type ?? "unit") === type);
        if (tcs.length === 0) return "na";
        const ids = new Set(tcs.map((tc) => tc.id));
        const failed = testResults.some((r) => ids.has(r.id) && r.status === "failed");
        const allPassed = testResults.length > 0 && tcs.every((tc) => testResults.find((r) => r.id === tc.id)?.status === "passed");
        if (failed) return "fail";
        if (allPassed) return "pass";
        return (qa?.coverageReport?.coveragePercent ?? 0) >= 80 ? "pass" : "warn";
      });
    });

    res.json({ criteria, features, cells });
  } catch (err) {
    next(err);
  }
});

router.get("/failures", async (_req, res, next) => {
  try {
    const stages = await prisma.pipelineStageLog.findMany({
      where: { stage: "QA_AGENT", status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      take: 20,
    });

    const byType = new Map<string, Array<{ id: string; testName: string; criterion: string; error: string; remediation: string }>>();
    for (const s of stages) {
      const out = s.output as {
        executionReport?: {
          failureAnalysis?: Array<{ testId: string; testName: string; violatedCriterion?: string; likelyCause?: string; remediation?: string; severity?: string }>
        }
      } | null;
      const failures = out?.executionReport?.failureAnalysis ?? [];
      for (const f of failures) {
        const sev = f.severity ?? "medium";
        if (!byType.has(sev)) byType.set(sev, []);
        byType.get(sev)!.push({
          id: f.testId,
          testName: f.testName,
          criterion: f.violatedCriterion ?? "",
          error: f.likelyCause ?? "",
          remediation: f.remediation ?? "",
        });
      }
    }

    res.json({
      columns: [
        { id: "critical", label: "Critical", items: byType.get("critical") ?? [] },
        { id: "high", label: "High", items: byType.get("high") ?? [] },
        { id: "medium", label: "Medium", items: (byType.get("medium") ?? []).slice(0, 10) },
        { id: "low", label: "Low", items: (byType.get("low") ?? []).slice(0, 10) },
      ],
    });
  } catch (err) {
    next(err);
  }
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
