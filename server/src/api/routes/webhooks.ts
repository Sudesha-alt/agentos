import { Router } from "express";
import { handleBitbucketWebhook } from "../../codebaseIntelligence/bitbucketWebhookHandler";
import { handleGithubWebhook } from "../../codebaseIntelligence/githubWebhookHandler";
import { handleAiWorkerWebhook } from "../../jira-intake/aiWorkerWebhookHandler";
import { intakeConfig } from "../../jira-intake/config";
import { handlePipelineJiraWebhook } from "../../pipeline/jira/webhookHandler";

const router = Router();

// Lane 1 — AI Worker intake only (status / board queue).
router.get("/jira", (_req, res) => {
  res.json({
    ok: true,
    message: "Lane 1 Jira intake. POST issue_updated (etc.) for AI Worker queue.",
    trackedStatuses: intakeConfig.aiWorkerStatuses,
    aiWorkerPath: "/webhooks/jira/ai-worker",
    pipelinePath: "/webhooks/jira/pipeline",
  });
});

router.post("/jira", (req, res) => {
  handleAiWorkerWebhook(req, res);
});

router.post("/jira/ai-worker", (req, res) => {
  handleAiWorkerWebhook(req, res);
});

// Lane 2 — agent pipeline ingress + mirror sync.
router.post("/jira/pipeline", (req, res, next) => {
  void handlePipelineJiraWebhook(req, res).catch(next);
});

router.post("/github", (req, res, next) => {
  void handleGithubWebhook(req, res).catch(next);
});

router.post("/bitbucket", (req, res, next) => {
  void handleBitbucketWebhook(req, res).catch(next);
});

export default router;
