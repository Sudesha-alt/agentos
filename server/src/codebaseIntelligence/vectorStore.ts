import { createClient } from "@supabase/supabase-js";
import { logger } from "../utils/logger";

let warnedMissingEmbeddingsTable = false;

function isMissingEmbeddingsTableError(error: { message?: string; code?: string }): boolean {
  const msg = (error.message ?? "").toLowerCase();
  return (
    msg.includes("codebase_embeddings") &&
    (msg.includes("schema cache") ||
      msg.includes("does not exist") ||
      msg.includes("not found") ||
      msg.includes("could not find the table"))
  );
}

function warnMissingEmbeddingsTable(): void {
  if (warnedMissingEmbeddingsTable) return;
  warnedMissingEmbeddingsTable = true;
  logger.warn(
    "codebase_embeddings table is missing in Supabase — semantic search and embedding writes are skipped. " +
      "Run server/sql/migrations via: npx tsx scripts/setup-supabase.ts"
  );
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name}`);
  return value;
}

const supabase = createClient(
  requiredEnv("SUPABASE_URL"),
  requiredEnv("SUPABASE_SERVICE_KEY")
);

export interface CodebaseEmbeddingRecord {
  filePath: string;
  repoOwner: string;
  repoName: string;
  branchName: string;
  chunkIndex: number;
  chunkContent: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  contentHash: string;
  organizationId: string;
}

export const codebaseVectorStore = {
  async replaceFileEmbeddings(
    organizationId: string,
    repoOwner: string,
    repoName: string,
    branchName: string,
    filePath: string,
    rows: CodebaseEmbeddingRecord[]
  ): Promise<void> {
    const { error: deleteError } = await supabase
      .from("codebase_embeddings")
      .delete()
      .eq("organization_id", organizationId)
      .eq("repo_owner", repoOwner)
      .eq("repo_name", repoName)
      .eq("branch_name", branchName)
      .eq("file_path", filePath);

    if (deleteError) {
      if (isMissingEmbeddingsTableError(deleteError)) {
        warnMissingEmbeddingsTable();
        return;
      }
      throw new Error(`Delete codebase embeddings failed: ${deleteError.message}`);
    }

    if (!rows.length) return;

    const payload = rows.map((row) => ({
      file_path: row.filePath,
      repo_owner: row.repoOwner,
      repo_name: row.repoName,
      branch_name: row.branchName,
      chunk_index: row.chunkIndex,
      chunk_content: row.chunkContent,
      embedding: row.embedding,
      metadata: row.metadata,
      content_hash: row.contentHash,
      organization_id: row.organizationId,
    }));

    const { error: insertError } = await supabase
      .from("codebase_embeddings")
      .insert(payload);

    if (insertError) {
      if (isMissingEmbeddingsTableError(insertError)) {
        warnMissingEmbeddingsTable();
        return;
      }
      throw new Error(`Insert codebase embeddings failed: ${insertError.message}`);
    }
  },

  async deleteFile(
    organizationId: string,
    repoOwner: string,
    repoName: string,
    branchName: string,
    filePath: string
  ): Promise<void> {
    const { error } = await supabase
      .from("codebase_embeddings")
      .delete()
      .eq("organization_id", organizationId)
      .eq("repo_owner", repoOwner)
      .eq("repo_name", repoName)
      .eq("branch_name", branchName)
      .eq("file_path", filePath);
    if (error) {
      logger.warn({ repoOwner, repoName, branchName, filePath, err: error }, "delete codebase embedding failed");
    }
  },
};
