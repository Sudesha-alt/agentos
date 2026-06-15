import { execSync } from "child_process";
import { logger } from "../utils/logger";
import { migrationDatabaseUrl } from "./pgPool";

/** Apply pending Prisma migrations before the API accepts traffic. */
export function runMigrationsOnStartup(): void {
  const migrateUrl = migrationDatabaseUrl();
  if (!migrateUrl) {
    logger.warn("DATABASE_URL not set — skipping prisma migrate deploy");
    return;
  }
  if (process.env.SKIP_PRISMA_MIGRATE === "true") {
    logger.info("SKIP_PRISMA_MIGRATE=true — skipping prisma migrate deploy");
    return;
  }

  try {
    logger.info("running prisma migrate deploy");
    const output = execSync("npx prisma migrate deploy", {
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_URL: migrateUrl,
      },
    });
    if (output.trim()) {
      logger.info({ output: output.trim() }, "prisma migrate deploy output");
    }
    logger.info("prisma migrate deploy complete");
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : typeof err === "object" && err && "stdout" in err
          ? String((err as { stdout?: string }).stdout ?? err)
          : String(err);
    logger.error({ err: message }, "prisma migrate deploy failed");
    throw new Error(`Database migration failed: ${message}`);
  }
}
