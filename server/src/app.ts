import express, {
  type ErrorRequestHandler,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import helmet from "helmet";
import healthRouter from "./api/routes/health";
import jiraIntakeRouter from "./api/routes/jiraIntake";
import overrideRouter from "./api/routes/override";
import pipelineRouter from "./api/routes/pipeline";
import webhooksRouter from "./api/routes/webhooks";
import { isAppError } from "./utils/errors";
import { logger } from "./utils/logger";

export function createApp(): express.Express {
  const app = express();

  app.use(helmet());
  app.use(express.json({ limit: "2mb" }));
  app.use((req, _res, next) => {
    logger.debug(
      { method: req.method, path: req.path, ip: req.ip },
      "request received"
    );
    next();
  });

  app.use("/", healthRouter);
  app.use("/", jiraIntakeRouter);
  app.use("/webhooks", webhooksRouter);
  app.use("/pipelines", pipelineRouter);
  app.use("/pipelines", overrideRouter);

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
