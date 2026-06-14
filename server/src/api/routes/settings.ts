import { Router } from "express";
import {
  getPublicCanarySettings,
  loadCanarySettingsFromStore,
  saveCanarySettings,
} from "../../canaryAgent/settingsStore";
import { workspaceBillingStore } from "../../billing/workspaceBillingStore";
import { ValidationError } from "../../utils/errors";

const router = Router();

const PLAN_IDS = new Set(["pilot", "starter", "growth", "enterprise"]);

router.get("/billing", async (_req, res, next) => {
  try {
    const billing = await workspaceBillingStore.get();
    res.json({ billing });
  } catch (err) {
    next(err);
  }
});

router.put("/billing", async (req, res, next) => {
  try {
    const planId = req.body?.planId ? String(req.body.planId) : undefined;
    if (planId && !PLAN_IDS.has(planId)) {
      throw new ValidationError(`Invalid planId: ${planId}`);
    }
    const billing = await workspaceBillingStore.save({
      planId: planId as "pilot" | "starter" | "growth" | "enterprise" | undefined,
      runsUsed:
        req.body?.runsUsed !== undefined ? Number(req.body.runsUsed) : undefined,
      runsCap: req.body?.runsCap !== undefined ? Number(req.body.runsCap) : undefined,
      pilotEndsAt:
        req.body?.pilotEndsAt !== undefined
          ? req.body.pilotEndsAt
            ? String(req.body.pilotEndsAt)
            : null
          : undefined,
      billingCycle:
        req.body?.billingCycle !== undefined
          ? String(req.body.billingCycle)
          : undefined,
    });
    res.json({ billing });
  } catch (err) {
    next(err);
  }
});

router.get("/", (_req, res) => {
  loadCanarySettingsFromStore();
  res.json({
    canary: getPublicCanarySettings(),
  });
});

router.put("/", (req, res) => {
  const stagingBaseUrl =
    req.body?.canaryStagingBaseUrl !== undefined
      ? String(req.body.canaryStagingBaseUrl)
      : undefined;
  const productionBaseUrl =
    req.body?.canaryProductionBaseUrl !== undefined
      ? String(req.body.canaryProductionBaseUrl)
      : undefined;
  const authToken =
    req.body?.canaryAuthToken !== undefined
      ? String(req.body.canaryAuthToken)
      : undefined;

  const canary = saveCanarySettings({
    stagingBaseUrl,
    productionBaseUrl,
    authToken,
  });

  res.json({ canary });
});

export default router;
