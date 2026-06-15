import express, {
  type ErrorRequestHandler,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import helmet from "helmet";
import authRouter from "./api/routes/auth";
import organizationRouter from "./api/routes/organization";
import onboardingRouter from "./api/routes/onboarding";
import codebaseRouter from "./api/routes/codebase";
import gitIntegrationRouter from "./api/routes/gitIntegration";
import healthRouter from "./api/routes/health";
import jiraIntakeRouter from "./api/routes/jiraIntake";
import jiraSyncRouter from "./api/routes/jiraSync";
import pipelineJiraRouter from "./api/routes/pipelineJira";
import overrideRouter from "./api/routes/override";
import pipelineRouter from "./api/routes/pipeline";
import pmAgentsRouter from "./api/routes/pmAgents";
import canaryRouter from "./api/routes/canary";
import orgIntelligenceRouter from "./api/routes/orgIntelligence";
import companyIntelligenceRouter from "./api/routes/companyIntelligence";
import qaRouter from "./api/routes/qa";
import settingsRouter from "./api/routes/settings";
import agentChatRouter from "./api/routes/agentChat";
import costsRouter from "./api/routes/costs";
import webhooksRouter from "./api/routes/webhooks";
import { isAppError } from "./utils/errors";
import { logger } from "./utils/logger";

export function createApp(): express.Express {
  const app = express();
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use((req, res, next) => {
    const allowed =
      process.env.CORS_ORIGIN?.split(",").map((o) => o.trim()) ?? ["*"];
    const origin = req.header("origin");
    if (origin && (allowed.includes("*") || allowed.includes(origin))) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    } else if (allowed.includes("*")) {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, x-agentos-secret, x-hub-signature-256, x-github-event, x-event-key, x-hub-signature"
    );
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });
  app.use(
    express.json({
      limit: "2mb",
      verify: (req, _res, buf) => {
        (req as Request & { rawBody?: string }).rawBody = buf.toString("utf8");
      },
    })
  );
  app.use((req, _res, next) => {
    logger.debug(
      { method: req.method, path: req.path, ip: req.ip },
      "request received"
    );
    next();
  });

  app.use("/", healthRouter);
  app.use("/api", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/organization", organizationRouter);
  app.use("/api/onboarding", onboardingRouter);
  app.use("/api/codebase", codebaseRouter);
  app.use("/codebase", codebaseRouter);
  app.use("/jira-intake", jiraIntakeRouter);
  app.use("/jira-sync", jiraSyncRouter);
  app.use("/api/jira-sync", jiraSyncRouter);
  app.use("/git-integration", gitIntegrationRouter);
  app.use("/pipeline-jira", pipelineJiraRouter);
  app.use("/webhooks", webhooksRouter);
  app.use("/pipelines", pipelineRouter);
  app.use("/pipelines", overrideRouter);
  app.use("/api/pipelines", pipelineRouter);
  app.use("/api/pipelines", overrideRouter);
  app.use("/pm-agents", pmAgentsRouter);
  app.use("/api/pm-agents", pmAgentsRouter);
  app.use("/api/canary", canaryRouter);
  app.use("/api/qa", qaRouter);
  app.use("/api/org-intelligence", orgIntelligenceRouter);
  app.use("/api/company-intelligence", companyIntelligenceRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/agent-chat", agentChatRouter);
  app.use("/api/costs", costsRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "not_found" });
  });

  const errorHandler: ErrorRequestHandler = (
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    if (isAppError(err)) {
      logger.warn(
        { code: err.code, message: err.message, metadata: err.metadata },
        "handled error"
      );
      res
        .status(err.statusCode)
        .json({ error: err.code, message: err.message, metadata: err.metadata });
      return;
    }
    logger.error({ err }, "unhandled error");
    res.status(500).json({ error: "internal_error" });
  };
  app.use(errorHandler);

  return app;
}
