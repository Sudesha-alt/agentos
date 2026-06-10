import { Router } from "express";
import { companyIntelligence } from "../../companyIntelligence";
import { ValidationError } from "../../utils/errors";

const router = Router();

router.get("/", async (_req, res, next) => {
  try {
    const profile = await companyIntelligence.getProfile();
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

router.put("/", async (req, res, next) => {
  try {
    const profile = await companyIntelligence.saveProfile({
      companyName: req.body?.companyName,
      website: req.body?.website,
      productSummary: req.body?.productSummary,
      icp: req.body?.icp,
      revenueModel: req.body?.revenueModel,
      pricingSummary: req.body?.pricingSummary,
      businessContext: req.body?.businessContext,
      strategicGoals: req.body?.strategicGoals,
      nonGoals: req.body?.nonGoals,
      updatedBy: req.body?.updatedBy ?? "user",
    });
    res.json({ profile });
  } catch (err) {
    next(err);
  }
});

router.post("/generate-context", async (req, res, next) => {
  try {
    const hasInput =
      req.body?.companyName ||
      req.body?.productSummary ||
      req.body?.revenueModel ||
      req.body?.businessContext;
    if (!hasInput) {
      throw new ValidationError(
        "Provide at least company name, product summary, or revenue model before generating context."
      );
    }
    const { profile, costUsd, model, vectorHitsUsed, codebaseFilesIndexed, repoLabel } =
      await companyIntelligence.generateContext({
      companyName: req.body?.companyName,
      website: req.body?.website,
      productSummary: req.body?.productSummary,
      icp: req.body?.icp,
      revenueModel: req.body?.revenueModel,
      pricingSummary: req.body?.pricingSummary,
      strategicGoals: req.body?.strategicGoals,
      nonGoals: req.body?.nonGoals,
      updatedBy: req.body?.updatedBy ?? "user",
      });
    res.json({
      profile,
      costUsd,
      model,
      vectorHitsUsed,
      codebaseFilesIndexed,
      repoLabel,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
