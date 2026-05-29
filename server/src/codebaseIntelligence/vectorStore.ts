import { createClient } from "@supabase/supabase-js";
import { logger } from "../utils/logger";

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
}

export const codebaseVectorStore = {
  async replaceFileEmbeddings(
    repoOwner: string,
    repoName: string,
    branchName: string,
    filePath: string,
    rows: CodebaseEmbeddingRecord[]
  ): Promise<void> {
    const { error: deleteError } = await supabase
      .from("codebase_embeddings")
      .delete()
      .eq("repo_owner", repoOwner)
      .eq("repo_name", repoName)
      .eq("branch_name", branchName)
      .eq("file_path", filePath);

    if (deleteError) {
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
    }));

    const { error: insertError } = await supabase
      .from("codebase_embeddings")
      .insert(payload);

    if (insertError) {
      throw new Error(`Insert codebase embeddings failed: ${insertError.message}`);
    }
  },

  async deleteFile(
    repoOwner: string,
    repoName: string,
    branchName: string,
    filePath: string
  ): Promise<void> {
    const { error } = await supabase
      .from("codebase_embeddings")
      .delete()
      .eq("repo_owner", repoOwner)
      .eq("repo_name", repoName)
      .eq("branch_name", branchName)
      .eq("file_path", filePath);
    if (error) {
      logger.warn({ repoOwner, repoName, branchName, filePath, err: error }, "delete codebase embedding failed");
    }
  },
};
