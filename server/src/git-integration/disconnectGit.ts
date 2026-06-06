import { prisma } from "../db/client";
import { clearGitCredentials } from "./gitCredentialsStore";
import { logger } from "../utils/logger";

const prismaAny = prisma as any;

/** Remove AgentOS git connection state (SQLite + Postgres). Does not uninstall the GitHub App on GitHub. */
export async function disconnectGitIntegration(): Promise<{
  disconnected: true;
  postgresInstallationsRemoved: number;
}> {
  clearGitCredentials();

  let postgresInstallationsRemoved = 0;
  if (process.env.DATABASE_URL?.trim()) {
    try {
      const result = await prismaAny.githubInstallation.deleteMany({});
      postgresInstallationsRemoved = result.count ?? 0;
    } catch (err) {
      logger.warn({ err }, "disconnect git — postgres cleanup failed");
    }
  }

  logger.info({ postgresInstallationsRemoved }, "git integration disconnected");
  return { disconnected: true, postgresInstallationsRemoved };
}
