import { Router } from "express";
import { canaryRunRepo } from "../../db/repositories/canaryRunRepo";

const router = Router();

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
