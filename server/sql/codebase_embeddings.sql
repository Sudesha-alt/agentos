-- Codebase RAG vector store (managed outside Prisma — uses pgvector + Supabase RPC)
-- Run once in Supabase: SQL Editor → New query → paste → Run

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS codebase_embeddings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path     TEXT NOT NULL,
  repo_owner    TEXT NOT NULL,
  repo_name     TEXT NOT NULL,
  branch_name   TEXT NOT NULL DEFAULT 'main',
  chunk_index   INT NOT NULL DEFAULT 0,
  chunk_content TEXT NOT NULL,
  embedding     vector(1536) NOT NULL,
  metadata      JSONB NOT NULL DEFAULT '{}',
  content_hash  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (repo_owner, repo_name, branch_name, file_path, chunk_index)
);

CREATE INDEX IF NOT EXISTS codebase_embeddings_repo_idx
  ON codebase_embeddings (repo_owner, repo_name, branch_name);

CREATE INDEX IF NOT EXISTS codebase_embeddings_file_idx
  ON codebase_embeddings (repo_owner, repo_name, branch_name, file_path);

CREATE INDEX IF NOT EXISTS codebase_embeddings_vector_idx
  ON codebase_embeddings
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Replace any older search_codebase signature (return type cannot change via OR REPLACE)
DROP FUNCTION IF EXISTS search_codebase(text, text, text, text, integer, double precision);
DROP FUNCTION IF EXISTS search_codebase(text, uuid, integer, double precision);
DROP FUNCTION IF EXISTS search_codebase(vector, uuid, integer, double precision);

DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT pg_proc.oid::regprocedure AS signature
    FROM pg_proc
    JOIN pg_namespace ON pg_namespace.oid = pg_proc.pronamespace
    WHERE pg_proc.proname = 'search_codebase'
      AND pg_namespace.nspname = 'public'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || fn.signature;
  END LOOP;
END $$;

-- Semantic search used by codebase Q&A (queryService.ts → search_codebase RPC)
CREATE OR REPLACE FUNCTION search_codebase(
  query_embedding   TEXT,
  p_repo_owner      TEXT,
  p_repo_name       TEXT,
  p_branch_name     TEXT,
  top_k             INT DEFAULT 8,
  similarity_threshold FLOAT DEFAULT 0.70
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
  v_embedding := query_embedding::vector;

  RETURN QUERY
  SELECT
    ce.file_path,
    ce.chunk_content,
    ce.chunk_index,
    (1 - (ce.embedding <=> v_embedding))::FLOAT AS similarity,
    ce.metadata
  FROM codebase_embeddings ce
  WHERE
    ce.repo_owner = p_repo_owner
    AND ce.repo_name = p_repo_name
    AND ce.branch_name = p_branch_name
    AND (1 - (ce.embedding <=> v_embedding)) >= similarity_threshold
  ORDER BY ce.embedding <=> v_embedding
  LIMIT top_k;
END;
$$;

-- Optional: allow service role / authenticated access via Supabase API
-- ALTER TABLE codebase_embeddings ENABLE ROW LEVEL SECURITY;
-- (Server uses SUPABASE_SERVICE_KEY and bypasses RLS by default.)
