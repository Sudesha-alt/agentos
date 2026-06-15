import type { PoolConfig } from "pg";

/**
 * Supabase / Render: connection strings often include sslmode=require, which makes
 * node-pg verify certs strictly. Strip sslmode from the URL and set ssl explicitly.
 *
 * Supabase pooler can drop idle connections — keepAlive + conservative pool size
 * reduce "Connection terminated unexpectedly" errors.
 */
export function pgPoolConfig(connectionString: string): PoolConfig {
  const stripped = connectionString
    .replace(/([?&])sslmode=[^&]*&?/g, "$1")
    .replace(/[?&]$/, "")
    .replace(/\?&/, "?");

  const host = tryParseHost(stripped);
  const isLocal =
    host === "localhost" || host === "127.0.0.1" || host === "";

  const max = Number(process.env.PG_POOL_MAX ?? 5);
  const poolMax = Number.isFinite(max) && max > 0 ? max : 5;

  return {
    connectionString: stripped,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
    max: poolMax,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 15_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  };
}

function tryParseHost(connectionString: string): string {
  try {
    const normalized = connectionString.replace(
      /^postgresql:\/\//,
      "http://"
    );
    return new URL(normalized).hostname;
  } catch {
    return "";
  }
}

/** Prefer direct Postgres URL for migrations (Supabase: db.*.supabase.co, not pooler). */
export function migrationDatabaseUrl(): string | undefined {
  const direct = process.env.DIRECT_DATABASE_URL?.trim();
  if (direct) return direct;
  return process.env.DATABASE_URL?.trim();
}
