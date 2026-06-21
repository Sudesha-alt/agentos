import { execSync } from "child_process";
import { logger } from "../utils/logger";
import { migrationDatabaseUrl } from "./pgPool";

const FAILED_MIGRATION_PATTERN = /Migration name:\s*(\S+)/;

function migrationEnv(migrateUrl: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    DATABASE_URL: migrateUrl,
  };
}

function execPrisma(command: string, migrateUrl: string): string {
  return execSync(command, {
    encoding: "utf8",
    env: migrationEnv(migrateUrl),
  });
}

function formatExecError(err: unknown): string {
  if (typeof err === "object" && err) {
    const stdout = "stdout" in err ? String((err as { stdout?: string }).stdout ?? "") : "";
    const stderr = "stderr" in err ? String((err as { stderr?: string }).stderr ?? "") : "";
    const combined = [stdout, stderr].filter(Boolean).join("\n");
    if (combined) return combined;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

function extractFailedMigrationName(message: string): string | null {
  const match = message.match(FAILED_MIGRATION_PATTERN);
  return match?.[1] ?? null;
}

function isFailedMigrationError(message: string): boolean {
  return message.includes("P3018") || message.includes("A migration failed to apply");
}

function resolveRolledBack(migrationName: string, migrateUrl: string): void {
  logger.warn({ migrationName }, "marking failed migration as rolled back before retry");
  execPrisma(`npx prisma migrate resolve --rolled-back "${migrationName}"`, migrateUrl);
}

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
    const output = execPrisma("npx prisma migrate deploy", migrateUrl);
    if (output.trim()) {
      logger.info({ output: output.trim() }, "prisma migrate deploy output");
    }
    logger.info("prisma migrate deploy complete");
  } catch (err) {
    const message = formatExecError(err);
    if (isFailedMigrationError(message)) {
      const migrationName = extractFailedMigrationName(message);
      if (migrationName) {
        try {
          resolveRolledBack(migrationName, migrateUrl);
          const retryOutput = execPrisma("npx prisma migrate deploy", migrateUrl);
          if (retryOutput.trim()) {
            logger.info({ output: retryOutput.trim() }, "prisma migrate deploy retry output");
          }
          logger.info("prisma migrate deploy complete after failed-migration recovery");
          return;
        } catch (retryErr) {
          const retryMessage = formatExecError(retryErr);
          logger.error({ err: retryMessage, migrationName }, "prisma migrate deploy retry failed");
          throw new Error(`Database migration failed after recovery attempt: ${retryMessage}`);
        }
      }
    }

    logger.error({ err: message }, "prisma migrate deploy failed");
    throw new Error(`Database migration failed: ${message}`);
  }
}
