import { Router } from "express";
import {
  getPublicCanarySettings,
  loadCanarySettingsFromStore,
  saveCanarySettings,
} from "../../canaryAgent/settingsStore";

const router = Router();

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
