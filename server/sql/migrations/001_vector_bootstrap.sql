-- Vector RAG bootstrap: vector_store (multi-chunk + org) + codebase_embeddings
-- Idempotent — safe to re-run on existing Supabase deployments.

CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- vector_store (tickets + pipeline artifacts)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS vector_store (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  jira_ticket_id TEXT NOT NULL,
  jira_key TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (
    content_type IN (
      'ticket',
      'prd',
      'qa_report',
      'implementation',
      'canary_finding',
      'org_intelligence',
      'company_intelligence'
    )
  ),
  content TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  chunk_index INT NOT NULL DEFAULT 0,
  organization_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE vector_store ADD COLUMN IF NOT EXISTS chunk_index INT NOT NULL DEFAULT 0;
ALTER TABLE vector_store ADD COLUMN IF NOT EXISTS organization_id TEXT;

UPDATE vector_store vs
SET organization_id = ji."organizationId"
FROM "JiraIssue" ji
WHERE vs.jira_key = ji."jiraKey"
  AND vs.organization_id IS NULL
  AND ji."organizationId" IS NOT NULL;

ALTER TABLE vector_store DROP CONSTRAINT IF EXISTS vector_store_content_type_check;
ALTER TABLE vector_store ADD CONSTRAINT vector_store_content_type_check
  CHECK (content_type IN (
    'ticket', 'prd', 'qa_report', 'implementation',
    'canary_finding', 'org_intelligence', 'company_intelligence'
  ));

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

CREATE INDEX IF NOT EXISTS vector_store_content_type_idx ON vector_store (content_type);
CREATE INDEX IF NOT EXISTS vector_store_jira_key_idx ON vector_store (jira_key);
CREATE INDEX IF NOT EXISTS vector_store_org_idx ON vector_store (organization_id);
CREATE INDEX IF NOT EXISTS vector_store_org_content_idx
  ON vector_store (organization_id, content_type);

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
    jira_ticket_id, jira_key, content_type, content, embedding, metadata,
    chunk_index, organization_id
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
      OR vs.organization_id = p_organization_id
    );
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
  PERFORM set_config('hnsw.ef_search', '100', true);
  PERFORM set_config('hnsw.iterative_scan', 'relaxed_order', true);
  PERFORM set_config('ivfflat.probes', '10', true);

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
      OR vs.organization_id = p_organization_id
    )
  ORDER BY vs.embedding <=> query_embedding::vector
  LIMIT top_k;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- codebase_embeddings (semantic code search)
-- ---------------------------------------------------------------------------

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
  organization_id TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE codebase_embeddings ADD COLUMN IF NOT EXISTS organization_id TEXT;

UPDATE vector_store vs
SET organization_id = ji."organizationId"
FROM "JiraIssue" ji
WHERE vs.jira_key = ji."jiraKey"
  AND vs.organization_id IS NULL
  AND ji."organizationId" IS NOT NULL;

UPDATE codebase_embeddings ce
SET organization_id = cf."organizationId"
FROM "CodebaseFile" cf
WHERE ce.file_path = cf."filePath"
  AND ce.repo_owner = cf."repoOwner"
  AND ce.repo_name = cf."repoName"
  AND ce.branch_name = cf."branchName"
  AND ce.organization_id IS NULL
  AND cf."organizationId" IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'codebase_embeddings_repo_owner_repo_name_branch_name_file_path_key'
  ) THEN
    ALTER TABLE codebase_embeddings
      DROP CONSTRAINT codebase_embeddings_repo_owner_repo_name_branch_name_file_path_key;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'codebase_embeddings_repo_owner_repo_name_branch_name_file_path_chunk_key'
  ) THEN
    ALTER TABLE codebase_embeddings
      DROP CONSTRAINT codebase_embeddings_repo_owner_repo_name_branch_name_file_path_chunk_key;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'codebase_embeddings_org_repo_file_chunk_unique'
  ) THEN
    ALTER TABLE codebase_embeddings
      ADD CONSTRAINT codebase_embeddings_org_repo_file_chunk_unique
      UNIQUE (organization_id, repo_owner, repo_name, branch_name, file_path, chunk_index);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS codebase_embeddings_repo_idx
  ON codebase_embeddings (organization_id, repo_owner, repo_name, branch_name);

CREATE INDEX IF NOT EXISTS codebase_embeddings_file_idx
  ON codebase_embeddings (organization_id, repo_owner, repo_name, branch_name, file_path);

-- Drop legacy search_codebase overloads
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

CREATE OR REPLACE FUNCTION search_codebase(
  query_embedding   TEXT,
  p_repo_owner      TEXT,
  p_repo_name       TEXT,
  p_branch_name     TEXT,
  top_k             INT DEFAULT 8,
  similarity_threshold FLOAT DEFAULT 0.70,
  p_organization_id TEXT DEFAULT NULL
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
  PERFORM set_config('ivfflat.probes', '10', true);

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
    AND (
      p_organization_id IS NULL
      OR ce.organization_id = p_organization_id
    )
    AND (1 - (ce.embedding <=> v_embedding)) >= similarity_threshold
  ORDER BY ce.embedding <=> v_embedding
  LIMIT top_k;
END;
$$;
