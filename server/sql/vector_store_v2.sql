-- Patch vector_store for multi-chunk ticket embeddings + org isolation.
-- Run in Supabase SQL editor after vector_store.sql

ALTER TABLE vector_store
  ADD COLUMN IF NOT EXISTS chunk_index INT NOT NULL DEFAULT 0;

ALTER TABLE vector_store
  ADD COLUMN IF NOT EXISTS organization_id TEXT;

CREATE INDEX IF NOT EXISTS vector_store_org_idx
  ON vector_store (organization_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vector_store_ticket_type_unique'
  ) THEN
    ALTER TABLE vector_store DROP CONSTRAINT vector_store_ticket_type_unique;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vector_store_ticket_type_chunk_unique'
  ) THEN
    ALTER TABLE vector_store
      ADD CONSTRAINT vector_store_ticket_type_chunk_unique
      UNIQUE (jira_ticket_id, content_type, chunk_index);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION upsert_vector(
  p_jira_ticket_id TEXT,
  p_jira_key TEXT,
  p_content_type TEXT,
  p_content TEXT,
  p_embedding TEXT,
  p_metadata JSONB,
  p_chunk_index INT DEFAULT 0,
  p_organization_id TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  INSERT INTO vector_store (
    jira_ticket_id, jira_key, content_type, content, embedding, metadata, chunk_index, organization_id
  )
  VALUES (
    p_jira_ticket_id,
    p_jira_key,
    p_content_type,
    p_content,
    p_embedding::vector,
    p_metadata,
    COALESCE(p_chunk_index, 0),
    p_organization_id
  )
  ON CONFLICT (jira_ticket_id, content_type, chunk_index)
  DO UPDATE SET
    jira_key = EXCLUDED.jira_key,
    content = EXCLUDED.content,
    embedding = EXCLUDED.embedding,
    metadata = EXCLUDED.metadata,
    organization_id = COALESCE(EXCLUDED.organization_id, vector_store.organization_id),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION similarity_search(
  query_embedding TEXT,
  content_types TEXT[],
  top_k INT,
  similarity_threshold FLOAT,
  exclude_keys TEXT[],
  p_organization_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  jira_ticket_id TEXT,
  jira_key TEXT,
  content_type TEXT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT,
  chunk_index INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    vs.id,
    vs.jira_ticket_id,
    vs.jira_key,
    vs.content_type,
    vs.content,
    vs.metadata,
    1 - (vs.embedding <=> query_embedding::vector) AS similarity,
    vs.chunk_index
  FROM vector_store vs
  WHERE
    vs.content_type = ANY(content_types)
    AND vs.jira_key != ALL(COALESCE(exclude_keys, ARRAY[]::TEXT[]))
    AND 1 - (vs.embedding <=> query_embedding::vector) >= similarity_threshold
    AND (
      p_organization_id IS NULL
      OR vs.organization_id IS NULL
      OR vs.organization_id = p_organization_id
    )
  ORDER BY vs.embedding <=> query_embedding::vector
  LIMIT top_k;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION delete_vectors_for_ticket_type(
  p_jira_key TEXT,
  p_content_type TEXT,
  p_organization_id TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  DELETE FROM vector_store vs
  WHERE
    vs.jira_key = p_jira_key
    AND vs.content_type = p_content_type
    AND (
      p_organization_id IS NULL
      OR vs.organization_id IS NULL
      OR vs.organization_id = p_organization_id
    );
END;
$$ LANGUAGE plpgsql;
