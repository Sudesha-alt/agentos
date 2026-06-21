-- Hybrid search: tsvector full-text + vector similarity fused with RRF (k=60).

ALTER TABLE vector_store ADD COLUMN IF NOT EXISTS content_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED;

ALTER TABLE codebase_embeddings ADD COLUMN IF NOT EXISTS content_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(chunk_content, ''))) STORED;

CREATE INDEX IF NOT EXISTS vector_store_content_tsv_idx
  ON vector_store USING gin (content_tsv);

CREATE INDEX IF NOT EXISTS codebase_embeddings_content_tsv_idx
  ON codebase_embeddings USING gin (content_tsv);

CREATE OR REPLACE FUNCTION hybrid_similarity_search(
  query_embedding TEXT,
  query_text TEXT,
  content_types TEXT[],
  top_k INT,
  similarity_threshold FLOAT,
  exclude_keys TEXT[],
  p_organization_id TEXT DEFAULT NULL,
  rrf_k INT DEFAULT 60
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
  PERFORM set_config('hnsw.ef_search', '100', true);
  PERFORM set_config('hnsw.iterative_scan', 'relaxed_order', true);

  RETURN QUERY
  WITH
  vector_hits AS (
    SELECT
      vs.id,
      vs.jira_ticket_id,
      vs.jira_key,
      vs.content_type,
      vs.content,
      vs.metadata,
      vs.chunk_index,
      1 - (vs.embedding <=> query_embedding::vector) AS vec_sim,
      ROW_NUMBER() OVER (
        ORDER BY vs.embedding <=> query_embedding::vector
      ) AS vec_rank
    FROM vector_store vs
    WHERE
      vs.content_type = ANY(content_types)
      AND vs.jira_key != ALL(COALESCE(exclude_keys, ARRAY[]::TEXT[]))
      AND 1 - (vs.embedding <=> query_embedding::vector) >= similarity_threshold
      AND (
        p_organization_id IS NULL
        OR vs.organization_id = p_organization_id
      )
    ORDER BY vs.embedding <=> query_embedding::vector
    LIMIT top_k * 2
  ),
  fts_hits AS (
    SELECT
      vs.id,
      vs.jira_ticket_id,
      vs.jira_key,
      vs.content_type,
      vs.content,
      vs.metadata,
      vs.chunk_index,
      ts_rank_cd(vs.content_tsv, plainto_tsquery('english', query_text)) AS fts_score,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank_cd(vs.content_tsv, plainto_tsquery('english', query_text)) DESC
      ) AS fts_rank
    FROM vector_store vs
    WHERE
      vs.content_type = ANY(content_types)
      AND vs.jira_key != ALL(COALESCE(exclude_keys, ARRAY[]::TEXT[]))
      AND vs.content_tsv @@ plainto_tsquery('english', query_text)
      AND (
        p_organization_id IS NULL
        OR vs.organization_id = p_organization_id
      )
    ORDER BY fts_score DESC
    LIMIT top_k * 2
  ),
  fused AS (
    SELECT
      COALESCE(v.id, f.id) AS id,
      COALESCE(v.jira_ticket_id, f.jira_ticket_id) AS jira_ticket_id,
      COALESCE(v.jira_key, f.jira_key) AS jira_key,
      COALESCE(v.content_type, f.content_type) AS content_type,
      COALESCE(v.content, f.content) AS content,
      COALESCE(v.metadata, f.metadata) AS metadata,
      COALESCE(v.chunk_index, f.chunk_index) AS chunk_index,
      COALESCE(v.vec_sim, 0) AS vec_sim,
      COALESCE(1.0 / (rrf_k + v.vec_rank), 0) + COALESCE(1.0 / (rrf_k + f.fts_rank), 0) AS rrf_score
    FROM vector_hits v
    FULL OUTER JOIN fts_hits f ON v.id = f.id
  )
  SELECT
    fused.id,
    fused.jira_ticket_id,
    fused.jira_key,
    fused.content_type,
    fused.content,
    fused.metadata,
    GREATEST(fused.vec_sim, fused.rrf_score)::FLOAT AS similarity,
    fused.chunk_index
  FROM fused
  ORDER BY fused.rrf_score DESC, fused.vec_sim DESC
  LIMIT top_k;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT pg_proc.oid::regprocedure AS signature
    FROM pg_proc
    JOIN pg_namespace ON pg_namespace.oid = pg_proc.pronamespace
    WHERE pg_proc.proname = 'hybrid_search_codebase'
      AND pg_namespace.nspname = 'public'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || fn.signature;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION hybrid_search_codebase(
  query_embedding   TEXT,
  query_text        TEXT,
  p_repo_owner      TEXT,
  p_repo_name       TEXT,
  p_branch_name     TEXT,
  top_k             INT DEFAULT 8,
  similarity_threshold FLOAT DEFAULT 0.70,
  p_organization_id TEXT DEFAULT NULL,
  rrf_k             INT DEFAULT 60
)
RETURNS TABLE (
  file_path     TEXT,
  chunk_content TEXT,
  chunk_index   INT,
  similarity    FLOAT,
  metadata      JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_embedding vector(1536);
BEGIN
  PERFORM set_config('hnsw.ef_search', '100', true);
  PERFORM set_config('hnsw.iterative_scan', 'relaxed_order', true);

  v_embedding := query_embedding::vector;

  RETURN QUERY
  WITH
  vector_hits AS (
    SELECT
      ce.file_path,
      ce.chunk_content,
      ce.chunk_index,
      ce.metadata,
      (1 - (ce.embedding <=> v_embedding))::FLOAT AS vec_sim,
      ROW_NUMBER() OVER (ORDER BY ce.embedding <=> v_embedding) AS vec_rank
    FROM codebase_embeddings ce
    WHERE
      ce.repo_owner = p_repo_owner
      AND ce.repo_name = p_repo_name
      AND ce.branch_name = p_branch_name
      AND (
        p_organization_id IS NULL
        OR ce.organization_id = p_organization_id
      )
      AND (1 - (ce.embedding <=> v_embedding)) >= similarity_threshold
    ORDER BY ce.embedding <=> v_embedding
    LIMIT top_k * 2
  ),
  fts_hits AS (
    SELECT
      ce.file_path,
      ce.chunk_content,
      ce.chunk_index,
      ce.metadata,
      ts_rank_cd(ce.content_tsv, plainto_tsquery('english', query_text)) AS fts_score,
      ROW_NUMBER() OVER (
        ORDER BY ts_rank_cd(ce.content_tsv, plainto_tsquery('english', query_text)) DESC
      ) AS fts_rank
    FROM codebase_embeddings ce
    WHERE
      ce.repo_owner = p_repo_owner
      AND ce.repo_name = p_repo_name
      AND ce.branch_name = p_branch_name
      AND (
        p_organization_id IS NULL
        OR ce.organization_id = p_organization_id
      )
      AND ce.content_tsv @@ plainto_tsquery('english', query_text)
    ORDER BY fts_score DESC
    LIMIT top_k * 2
  ),
  fused AS (
    SELECT
      COALESCE(v.file_path, f.file_path) AS file_path,
      COALESCE(v.chunk_content, f.chunk_content) AS chunk_content,
      COALESCE(v.chunk_index, f.chunk_index) AS chunk_index,
      COALESCE(v.metadata, f.metadata) AS metadata,
      COALESCE(v.vec_sim, 0) AS vec_sim,
      COALESCE(1.0 / (rrf_k + v.vec_rank), 0) + COALESCE(1.0 / (rrf_k + f.fts_rank), 0) AS rrf_score
    FROM vector_hits v
    FULL OUTER JOIN fts_hits f
      ON v.file_path = f.file_path AND v.chunk_index = f.chunk_index
  )
  SELECT
    fused.file_path,
    fused.chunk_content,
    fused.chunk_index,
    GREATEST(fused.vec_sim, fused.rrf_score)::FLOAT AS similarity,
    fused.metadata
  FROM fused
  ORDER BY fused.rrf_score DESC, fused.vec_sim DESC
  LIMIT top_k;
END;
$$;
