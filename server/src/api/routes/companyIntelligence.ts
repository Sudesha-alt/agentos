import { Router, type Request } from "express";
import { companyIntelligence } from "../../companyIntelligence";
import { ValidationError } from "../../utils/errors";
import { resolveUserFromAuthHeader } from "./authSession";
import {
  activateOrganizationJiraContext,
  warmOrganizationJiraCredentials,
} from "../../pipeline/jira/credentialsStore";
import { setActiveOrganizationId } from "../../organization/context";

const router = Router();

function resolveOrganizationId(req: Request): string | undefined {
  const user = resolveUserFromAuthHeader(req);
  return user?.organizationId;
}

async function withOrganizationContext(
  req: Request,
  fn: (organizationId?: string) => Promise<void>
) {
  const organizationId = resolveOrganizationId(req);
  if (organizationId) {
    setActiveOrganizationId(organizationId);
    await warmOrganizationJiraCredentials(organizationId);
    activateOrganizationJiraContext(organizationId);
  }
  try {
    await fn(organizationId);
  } finally {
    setActiveOrganizationId(null);
    activateOrganizationJiraContext(null);
  }
}

router.get("/", async (req, res, next) => {
  try {
    await withOrganizationContext(req, async (organizationId) => {
      const profile = await companyIntelligence.getProfile(organizationId);
      res.json({ profile });
    });
  } catch (err) {
    next(err);
  }
});

router.put("/", async (req, res, next) => {
  try {
    await withOrganizationContext(req, async (organizationId) => {
      const profile = await companyIntelligence.saveProfile(
        {
          companyName: req.body?.companyName,
          website: req.body?.website,
          productSummary: req.body?.productSummary,
          icp: req.body?.icp,
          revenueModel: req.body?.revenueModel,
          pricingSummary: req.body?.pricingSummary,
          businessContext: req.body?.businessContext,
          strategicGoals: req.body?.strategicGoals,
          nonGoals: req.body?.nonGoals,
          competitors: req.body?.competitors,
          updatedBy: req.body?.updatedBy ?? "user",
        },
        organizationId
      );
      res.json({ profile });
    });
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

router.post("/fetch-from-web", async (req, res, next) => {
  try {
    const website = String(req.body?.website ?? "").trim();
    if (!website) {
      throw new ValidationError("Website URL is required to auto-fetch company details.");
    }
    const result = await companyIntelligence.fetchFromWeb({
      website,
      companyName: req.body?.companyName,
      mergeWithProfile: {
        companyName: req.body?.companyName,
        website: req.body?.website,
        productSummary: req.body?.productSummary,
        icp: req.body?.icp,
        revenueModel: req.body?.revenueModel,
        pricingSummary: req.body?.pricingSummary,
        strategicGoals: req.body?.strategicGoals,
        nonGoals: req.body?.nonGoals,
      },
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/fetch-competitors", async (req, res, next) => {
  try {
    const website = String(req.body?.website ?? "").trim();
    if (!website) {
      throw new ValidationError("Website URL is required to discover competitors.");
    }
    const result = await companyIntelligence.fetchCompetitors({
      website,
      companyName: req.body?.companyName,
      productSummary: req.body?.productSummary,
      mergeWithProfile: {
        companyName: req.body?.companyName,
        website: req.body?.website,
        productSummary: req.body?.productSummary,
        competitors: req.body?.competitors,
      },
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
