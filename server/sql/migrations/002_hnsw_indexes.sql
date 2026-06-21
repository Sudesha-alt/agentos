-- Replace IVFFlat with HNSW indexes for production recall under filtered queries.
-- Run after bulk data load when possible; safe to re-run (IF NOT EXISTS).

DROP INDEX IF EXISTS vector_store_embedding_idx;
DROP INDEX IF EXISTS codebase_embeddings_vector_idx;

CREATE INDEX IF NOT EXISTS vector_store_embedding_hnsw_idx
  ON vector_store
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

CREATE INDEX IF NOT EXISTS codebase_embeddings_vector_hnsw_idx
  ON codebase_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

ANALYZE vector_store;
ANALYZE codebase_embeddings;
