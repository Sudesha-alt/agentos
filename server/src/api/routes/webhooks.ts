import { Router } from "express";
import { handleJiraWebhook } from "../../integrations/webhookHandler";
import { logger } from "../../utils/logger";

const router = Router();

// Jira webhooks should send a shared-secret in a header we agreed on when
// registering the webhook. Reject anything that doesn't match.
router.post("/jira", (req, res, next) => {
  const expected = process.env.JIRA_WEBHOOK_SECRET;
  if (expected) {
    const provided = req.header("x-agentos-secret");
    if (provided !== expected) {
      logger.warn({ ip: req.ip }, "rejected webhook — bad secret");
      res.status(401).json({ error: "unauthorized" });
      return;
    }
  }
  void handleJiraWebhook(req, res).catch(next);
});

export default router;
