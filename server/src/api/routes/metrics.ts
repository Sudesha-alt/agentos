import { Router } from "express";
import {
  buildDashboardStatusMetrics,
  getAgentHealth,
  getCycleTrend,
  getMetricsSummary,
  getWeeklyTrend,
} from "../../metrics/dashboardMetrics";
import { requireOrganizationUser } from "../orgRequestContext";

const router = Router();

router.get("/summary", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    const summary = await getMetricsSummary(user.organizationId);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

router.get("/cycle-trend", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    const trend = await getCycleTrend(user.organizationId);
    res.json(trend);
  } catch (err) {
    next(err);
  }
});

router.get("/weekly-trend", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    const trend = await getWeeklyTrend(user.organizationId);
    res.json(trend);
  } catch (err) {
    next(err);
  }
});

router.get("/agent-health", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    const health = await getAgentHealth(user.organizationId);
    res.json(health);
  } catch (err) {
    next(err);
  }
});

router.post("/dashboard-status", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    const body = req.body ?? {};
    res.json(
      buildDashboardStatusMetrics({
        running: Number(body.running) || 0,
        review: Number(body.review) || 0,
        completedToday: Number(body.completedToday) || 0,
        costToday: typeof body.costToday === "string" ? body.costToday : undefined,
        passRate: typeof body.passRate === "string" ? body.passRate : undefined,
      })
    );
  } catch (err) {
    next(err);
  }
});

export default router;
