import "dotenv/config";
import * as Sentry from "@sentry/node";
import { createApp } from "./app";
import { loadJiraCredentialsFromStore } from "./jira-intake/jiraCredentialsStore";
import { initIntakeDb } from "./jira-intake/sqliteStore";
import { initCodebaseVizWebSocket } from "./codebaseIntelligence/codebaseVizHub";
import { logger } from "./utils/logger";

initIntakeDb();
loadJiraCredentialsFromStore();

if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN });
}

const port = Number(process.env.PORT ?? 4000);
const app = createApp();

const server = app.listen(port, () => {
  logger.info({ port }, "agentos-server listening");
});

initCodebaseVizWebSocket(server);

function shutdown(signal: string): void {
  logger.info({ signal }, "shutting down");
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
