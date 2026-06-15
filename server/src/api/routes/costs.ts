import { Router } from "express";
import { computeEstimatedRoi } from "../../roi/estimatedRoi";
import {
  getCostsByFeature,
  getCostsDaily,
  getCostsSummary,
} from "../../roi/actualRoi";
import { normalizePlanId } from "../../roi/assumptions";
import {
  requireOrganizationUser,
  withOrganizationContext,
} from "../orgRequestContext";

const router = Router();

router.get("/summary", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    await withOrganizationContext(user.organizationId, async () => {
      const summary = await getCostsSummary(user.organizationId);
      res.json(summary);
    });
  } catch (err) {
    next(err);
  }
});

router.get("/daily", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    await withOrganizationContext(user.organizationId, async () => {
      const daily = await getCostsDaily(user.organizationId);
      res.json(daily);
    });
  } catch (err) {
    next(err);
  }
});

router.get("/by-feature", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    await withOrganizationContext(user.organizationId, async () => {
      const hourlyRate = Number(req.query.hourlyRate) || 150;
      const data = await getCostsByFeature(hourlyRate, user.organizationId);
      res.json(data);
    });
  } catch (err) {
    next(err);
  }
});

router.get("/roi", (req, res) => {
  const result = computeEstimatedRoi({
    planId: normalizePlanId(req.query.planId),
    teamSize: Number(req.query.teamSize),
    hourlyRate: Number(req.query.hourlyRate),
    pipelineRunsPerMonth: Number(req.query.pipelineRunsPerMonth),
    sprintWeeks: Number(req.query.sprintWeeks),
    reworkRate: Number(req.query.reworkRate),
    baselineHoursPerRun: Number(req.query.baselineHoursPerRun) || undefined,
  });
  res.json({ roi: result });
});

export default router;
