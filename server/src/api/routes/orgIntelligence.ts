import { Router } from "express";
import { orgIntelligence } from "../../orgIntelligence";
import {
  requireOrganizationUser,
  withOrganizationContext,
} from "../orgRequestContext";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    await withOrganizationContext(user.organizationId, async () => {
      const jiraKey = typeof req.query.jiraKey === "string" ? req.query.jiraKey : undefined;
      const sourceType =
        typeof req.query.sourceType === "string" ? req.query.sourceType : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const items = await orgIntelligence.listRecent({ jiraKey, sourceType, limit });
      res.json({ items });
    });
  } catch (err) {
    next(err);
  }
});

export default router;
