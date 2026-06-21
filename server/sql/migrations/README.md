# Vector SQL migrations

Run in order via `npx tsx scripts/setup-supabase.ts` or manually in Supabase SQL Editor.

| File | Purpose |
|------|---------|
| `001_vector_bootstrap.sql` | Tables, org-scoped RPCs (`upsert_vector`, `similarity_search`, `search_codebase`) |
| `002_hnsw_indexes.sql` | HNSW vector indexes (replaces IVFFlat) + `ANALYZE` |
| `003_hybrid_search.sql` | `tsvector` columns + RRF hybrid RPCs |

## Ops runbook

- After **>30% row growth** or **embedding model change**: re-run `002_hnsw_indexes.sql` and re-embed affected rows.
- Tune recall: increase `hnsw.ef_search` (100–200) in RPC `set_config` calls.
- Backfill missing `organization_id`: `npx tsx scripts/backfill-vector-org-ids.ts`
