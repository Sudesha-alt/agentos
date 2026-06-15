import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/client";
import { pgPoolConfig } from "./pgPool";
import { logger } from "../utils/logger";

declare global {
  // Reuse Prisma client across hot reloads in dev to avoid connection storms.
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var __prismaPool: Pool | undefined;
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required for pipeline features");
  }

  const pool = new Pool(pgPoolConfig(connectionString));
  pool.on("error", (err) => {
    logger.warn({ err }, "postgres pool idle client error");
  });
  global.__prismaPool = pool;

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "production"
        ? ["error", "warn"]
        : ["query", "error", "warn"],
  });
}

export async function disconnectPrisma(): Promise<void> {
  const client = global.__prisma;
  if (client) {
    await client.$disconnect().catch(() => undefined);
    global.__prisma = undefined;
  }
  const pool = global.__prismaPool;
  if (pool) {
    await pool.end().catch(() => undefined);
    global.__prismaPool = undefined;
  }
}

export function getPrisma(): PrismaClient | null {
  if (!process.env.DATABASE_URL) return null;
  if (!global.__prisma) {
    global.__prisma = createPrismaClient();
  }
  return global.__prisma;
}

function requirePrisma(): PrismaClient {
  const client = getPrisma();
  if (!client) {
    throw new Error("DATABASE_URL is required for pipeline features");
  }
  return client;
}

/** Lazy Prisma client; pipeline routes need DATABASE_URL. */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = requirePrisma();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});
