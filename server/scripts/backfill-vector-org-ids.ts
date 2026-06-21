/**
 * Backfill organization_id on vector rows from Prisma JiraIssue / CodebaseFile.
 * Usage: npx tsx scripts/backfill-vector-org-ids.ts
 */
import "dotenv/config";
import pg from "pg";

function pgPool() {
  return new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes("supabase")
      ? { rejectUnauthorized: false }
      : undefined,
  });
}

async function main() {
  const pool = pgPool();
  try {
    const ticketResult = await pool.query(`
      UPDATE vector_store vs
      SET organization_id = ji."organizationId"
      FROM "JiraIssue" ji
      WHERE vs.jira_key = ji."jiraKey"
        AND vs.organization_id IS NULL
        AND ji."organizationId" IS NOT NULL
    `);
    console.log(`[ok] vector_store backfill: ${ticketResult.rowCount ?? 0} rows`);

    const codeResult = await pool.query(`
      UPDATE codebase_embeddings ce
      SET organization_id = cf."organizationId"
      FROM "CodebaseFile" cf
      WHERE ce.file_path = cf."filePath"
        AND ce.repo_owner = cf."repoOwner"
        AND ce.repo_name = cf."repoName"
        AND ce.branch_name = cf."branchName"
        AND ce.organization_id IS NULL
        AND cf."organizationId" IS NOT NULL
    `);
    console.log(`[ok] codebase_embeddings backfill: ${codeResult.rowCount ?? 0} rows`);
  } finally {
    await pool.end().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
