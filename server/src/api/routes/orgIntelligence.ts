import { Router } from "express";
import { orgIntelligence } from "../../orgIntelligence";

const router = Router();

router.get("/", async (req, res, next) => {
  try {
    const jiraKey = typeof req.query.jiraKey === "string" ? req.query.jiraKey : undefined;
    const sourceType =
      typeof req.query.sourceType === "string" ? req.query.sourceType : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const items = await orgIntelligence.listRecent({ jiraKey, sourceType, limit });
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

export default router;
