import { createClient } from "@supabase/supabase-js";
import type { VectorContentType } from "../types/pipeline";
import { requireActiveOrganizationId } from "../organization/orgScope";
import { logger } from "../utils/logger";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name}`);
  }
  return value;
}

const supabase = createClient(
  requiredEnv("SUPABASE_URL"),
  requiredEnv("SUPABASE_SERVICE_KEY")
);

export interface VectorRecord {
  id: string;
  jiraTicketId: string;
  jiraKey: string;
  contentType: VectorContentType;
  content: string;
  metadata: Record<string, unknown>;
  similarity?: number;
  chunkIndex?: number;
}

export interface SearchOptions {
  contentTypes: readonly VectorContentType[];
  topK: number;
  similarityThreshold: number;
  excludeJiraKeys?: string[];
  organizationId?: string;
}

interface SimilaritySearchRow {
  id: string;
  jira_ticket_id: string;
  jira_key: string;
  content_type: VectorContentType;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
  chunk_index?: number;
}

interface VectorTableRow {
  id: string;
  jira_ticket_id: string;
  jira_key: string;
  content_type: VectorContentType;
  content: string;
  metadata: Record<string, unknown>;
  chunk_index?: number;
}

function resolveOrganizationId(explicit?: string): string | undefined {
  try {
    return explicit ?? requireActiveOrganizationId();
  } catch {
    return explicit;
  }
}

export const vectorStore = {
  async upsert(record: {
    jiraTicketId: string;
    jiraKey: string;
    contentType: VectorContentType;
    content: string;
    embedding: number[];
    metadata: Record<string, unknown>;
    chunkIndex?: number;
    organizationId?: string;
  }): Promise<void> {
    const organizationId = resolveOrganizationId(record.organizationId);
    const { error } = await supabase.rpc("upsert_vector", {
      p_jira_ticket_id: record.jiraTicketId,
      p_jira_key: record.jiraKey,
      p_content_type: record.contentType,
      p_content: record.content,
      p_embedding: JSON.stringify(record.embedding),
      p_metadata: record.metadata,
      p_chunk_index: record.chunkIndex ?? 0,
      p_organization_id: organizationId ?? null,
    });

    if (error) {
      logger.error({ err: error, jiraKey: record.jiraKey }, "vector store upsert failed");
      throw new Error(`Vector store upsert failed: ${error.message}`);
    }

    logger.info(
      { jiraKey: record.jiraKey, contentType: record.contentType, chunkIndex: record.chunkIndex ?? 0 },
      "vector stored"
    );
  },

  async deleteByJiraKeyAndContentType(
    jiraKey: string,
    contentType: VectorContentType,
    organizationId?: string
  ): Promise<void> {
    const orgId = resolveOrganizationId(organizationId);
    const { error } = await supabase.rpc("delete_vectors_for_ticket_type", {
      p_jira_key: jiraKey,
      p_content_type: contentType,
      p_organization_id: orgId ?? null,
    });
    if (error) {
      logger.warn({ err: error, jiraKey, contentType }, "vector chunk delete failed — falling back");
      const q = supabase
        .from("vector_store")
        .delete()
        .eq("jira_key", jiraKey)
        .eq("content_type", contentType);
      if (orgId) q.eq("organization_id", orgId);
      await q;
    }
  },

  async similaritySearch(
    queryEmbedding: number[],
    options: SearchOptions
  ): Promise<VectorRecord[]> {
    const {
      contentTypes,
      topK,
      similarityThreshold,
      excludeJiraKeys = [],
      organizationId,
    } = options;

    const orgId = resolveOrganizationId(organizationId);

    const { data, error } = await supabase.rpc("similarity_search", {
      query_embedding: JSON.stringify(queryEmbedding),
      content_types: contentTypes,
      top_k: topK,
      similarity_threshold: similarityThreshold,
      exclude_keys: excludeJiraKeys,
      p_organization_id: orgId ?? null,
    });

    if (error) {
      logger.error({ err: error }, "similarity search failed");
      throw new Error(`Similarity search failed: ${error.message}`);
    }

    return ((data ?? []) as SimilaritySearchRow[]).map((row) => ({
      id: row.id,
      jiraTicketId: row.jira_ticket_id,
      jiraKey: row.jira_key,
      contentType: row.content_type,
      content: row.content,
      metadata: row.metadata,
      similarity: row.similarity,
      chunkIndex: row.chunk_index ?? 0,
    }));
  },

  async deleteByJiraKey(jiraKey: string): Promise<void> {
    const { error } = await supabase.from("vector_store").delete().eq("jira_key", jiraKey);
    if (error) {
      logger.error({ err: error, jiraKey }, "vector delete failed");
      throw new Error(`Vector delete failed: ${error.message}`);
    }
  },

  async getByJiraKey(jiraKey: string): Promise<VectorRecord[]> {
    const { data, error } = await supabase
      .from("vector_store")
      .select("*")
      .eq("jira_key", jiraKey);

    if (error) {
      throw new Error(error.message);
    }

    return ((data ?? []) as VectorTableRow[]).map((row) => ({
      id: row.id,
      jiraTicketId: row.jira_ticket_id,
      jiraKey: row.jira_key,
      contentType: row.content_type,
      content: row.content,
      metadata: row.metadata,
      chunkIndex: row.chunk_index ?? 0,
    }));
  },
};
