/**
 * One-shot Supabase bootstrap: vector_store SQL, Prisma migrations, optional re-index + Jira sync.
 * Usage: npx tsx scripts/setup-supabase.ts [--skip-index] [--skip-jira]
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { execSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const skipIndex = args.has("--skip-index");
const skipJira = args.has("--skip-jira");

function pgPool() {
  return new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes("supabase")
      ? { rejectUnauthorized: false }
      : undefined,
  });
}

async function runVectorStoreSql(pool: pg.Pool) {
  const sqlPath = join(__dirname, "..", "sql", "vector_store.sql");
  const sql = readFileSync(sqlPath, "utf8");
  await pool.query(sql);
  const check = await pool.query(
    `SELECT COUNT(*)::int AS c FROM information_schema.tables WHERE table_schema='public' AND table_name='vector_store'`
  );
  if (check.rows[0]?.c !== 1) {
    throw new Error("vector_store table was not created");
  }
  console.log("[ok] vector_store table + RPCs");
}

async function verifyRpcs(pool: pg.Pool) {
  const zeroVec = JSON.stringify(Array(1536).fill(0));
  await pool.query(`SELECT * FROM similarity_search($1::text, $2::text[], 1, 0, $3::text[])`, [
    zeroVec,
    ["ticket"],
    [],
  ]);
  console.log("[ok] similarity_search RPC");
  await pool.query(
    `SELECT upsert_vector($1,$2,$3,$4,$5,$6)`,
    ["__setup__", "__SETUP__", "ticket", "setup probe", zeroVec, { setup: true }]
  );
  await pool.query(`DELETE FROM vector_store WHERE jira_key = '__SETUP__'`);
  console.log("[ok] upsert_vector RPC");
}

async function printCounts(pool: pg.Pool) {
  const rows = await pool.query(`
    SELECT 'vector_store' AS label, COUNT(*)::int AS c FROM vector_store
    UNION ALL
    SELECT 'codebase_embeddings', COUNT(*)::int FROM codebase_embeddings
    UNION ALL
    SELECT 'JiraIssue', COUNT(*)::int FROM "JiraIssue"
    UNION ALL
    SELECT 'CodebaseFile', COUNT(*)::int FROM "CodebaseFile"
  `);
  console.log("\nCounts:");
  for (const r of rows.rows) {
    console.log(`  ${r.label}: ${r.c}`);
  }
}

async function main() {
  const pool = pgPool();
  try {
    console.log("Step 1: vector_store SQL");
    await runVectorStoreSql(pool);
    await verifyRpcs(pool);

    console.log("\nStep 2: Prisma migrate deploy");
    execSync("npx prisma migrate deploy", {
      cwd: join(__dirname, ".."),
      stdio: "inherit",
      env: process.env,
    });
    console.log("[ok] prisma migrate deploy");

    if (!skipIndex) {
      console.log("\nStep 3: codebase full re-index (embeddings)");
      const { runFullIndex } = await import("../src/codebaseIntelligence/indexer");
      const { resolveRepoScope } = await import("../src/codebaseIntelligence/repoScope");
      const scope = resolveRepoScope();
      if (!scope) {
        console.warn("[skip] no repo scope — connect GitHub or set GITHUB_REPO_OWNER/NAME");
      } else if (!process.env.OPENAI_API_KEY?.trim()) {
        console.warn("[skip] OPENAI_API_KEY not set — cannot embed files");
      } else {
        const branch = scope.defaultBranch ?? "main";
        console.log(`  indexing ${scope.repoOwner}/${scope.repoName}@${branch}...`);
        await runFullIndex(branch, { triggerType: "manual" });
        console.log("[ok] codebase full index");
      }
    }

    if (!skipJira) {
      console.log("\nStep 4: Jira full sync + embed");
      try {
        const { validatePipelineJiraConfig } = await import(
          "../src/pipeline/jira/credentialsStore"
        );
        validatePipelineJiraConfig();
        const { runJiraFullSync } = await import("../src/jira-sync/syncService");
        const result = await runJiraFullSync();
        console.log("[ok] jira full sync", result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[skip] jira sync: ${msg}`);
      }
    }

    await printCounts(pool);
    console.log("\nSetup complete.");
  } finally {
    await pool.end().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
