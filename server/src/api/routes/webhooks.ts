import { Router } from "express";
import { handleBitbucketWebhook } from "../../codebaseIntelligence/bitbucketWebhookHandler";
import { handleGithubWebhook } from "../../codebaseIntelligence/githubWebhookHandler";
import { handleAiWorkerWebhook } from "../../jira-intake/aiWorkerWebhookHandler";
import { intakeConfig } from "../../jira-intake/config";
import { getWebhookSecret } from "../../jira-intake/jiraCredentialsStore";
import { handleJiraWebhook } from "../../integrations/webhookHandler";
import { logger } from "../../utils/logger";

const router = Router();

function isPipelineCreateEvent(body: unknown): boolean {
  return (
    typeof body === "object" &&
    body !== null &&
    (body as { webhookEvent?: string }).webhookEvent === "jira:issue_created"
  );
}

// Legacy URL used by Jira + ngrok: same path as the standalone Jira Webhook app.
// issue_created → agent pipeline; all other events (e.g. issue_updated) → AI Worker intake.
router.get("/jira", (_req, res) => {
  res.json({
    ok: true,
    message:
      "Jira webhook. POST issue_created for pipeline; POST issue_updated (etc.) for AI Worker intake.",
    trackedStatuses: intakeConfig.aiWorkerStatuses,
    aiWorkerPath: "/webhooks/jira/ai-worker",
  });
});

router.post("/jira", (req, res, next) => {
  if (isPipelineCreateEvent(req.body)) {
    const expected = getWebhookSecret();
    if (expected) {
      const provided = req.header("x-agentos-secret");
      if (provided !== expected) {
        logger.warn({ ip: req.ip }, "rejected pipeline webhook — bad secret");
        res.status(401).json({ error: "unauthorized" });
        return;
      }
    }
    void handleJiraWebhook(req, res).catch(next);
    return;
  }

  handleAiWorkerWebhook(req, res);
});

router.post("/jira/ai-worker", (req, res) => {
  handleAiWorkerWebhook(req, res);
});

router.post("/github", (req, res, next) => {
  void handleGithubWebhook(req, res).catch(next);
});

router.post("/bitbucket", (req, res, next) => {
  void handleBitbucketWebhook(req, res).catch(next);
});

export default router;
