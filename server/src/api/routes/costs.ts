import { Router } from "express";
import { computeEstimatedRoi } from "../../roi/estimatedRoi";
import {
  getCostsByFeature,
  getCostsDaily,
  getCostsSummary,
} from "../../roi/actualRoi";
import { normalizePlanId } from "../../roi/assumptions";

const router = Router();

router.get("/summary", async (_req, res, next) => {
  try {
    const summary = await getCostsSummary();
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

router.get("/daily", async (_req, res, next) => {
  try {
    const daily = await getCostsDaily();
    res.json(daily);
  } catch (err) {
    next(err);
  }
});

router.get("/by-feature", async (req, res, next) => {
  try {
    const hourlyRate = Number(req.query.hourlyRate) || 150;
    const data = await getCostsByFeature(hourlyRate);
    res.json(data);
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
