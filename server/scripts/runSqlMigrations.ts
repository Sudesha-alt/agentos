/**
 * Run ordered SQL migrations from server/sql/migrations/.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type pg from "pg";

const MIGRATIONS_DIR = join(__dirname, "..", "sql", "migrations");

export function listMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

export async function runSqlMigrations(pool: pg.Pool): Promise<void> {
  const files = listMigrationFiles();
  if (!files.length) {
    throw new Error(`No SQL migrations found in ${MIGRATIONS_DIR}`);
  }

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    console.log(`  running ${file}...`);
    await pool.query(sql);
    console.log(`  [ok] ${file}`);
  }
}
