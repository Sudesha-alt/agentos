# Agentos Server — Phase 1

Multi-AI agent orchestration engine. A Jira ticket arrives via webhook, passes
through three agents in sequence (Product → Engineering → QA) with a
validation gate between each handoff, and is written back to Jira. A human is
in control at every stage transition.

## Stack

- Node.js + TypeScript, Express
- PostgreSQL (Supabase) with `pgvector`
- Prisma ORM
- In-process background tasks (indexing + pipelines on the API event loop)
- OpenAI **GPT-5.1** for all agent reasoning, codebase ask/tour, and file summaries
- OpenAI `text-embedding-3-small` for RAG embeddings
- Sentry + Pino structured logging

## Folder layout

```
src/
  agents/        baseAgent, productAgent, engineeringAgent, qaAgent
  validators/    prdValidator, implementationValidator, qaValidator
  pipeline/      orchestrator, stateManager, contextBuilder
  integrations/  jiraClient, webhookHandler, ticketNormalizer, intentClassifier
  rag/           vectorStore, embedder, retriever, contextCompressor, indexer
  queue/         inProcessRunner (fire-and-forget pipelines)
  db/            client + repositories (ticket, pipeline, audit)
  api/routes/    webhooks, pipeline, override, health
  types/         ticket, pipeline, agents
  utils/         logger, errors, retry
  app.ts, server.ts
prisma/schema.prisma
```

## Quick start

```bash
cp .env.example .env
# fill in DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY,
# OPENAI_API_KEY (GPT-5.1), JIRA_*

npm install
npm run prisma:generate
npm run prisma:migrate     # applies schema to Supabase
```

Then run the Layer 2 vector-store SQL in the Supabase SQL editor. The RAG
table is managed outside Prisma on purpose:

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS vector_store (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  jira_ticket_id TEXT NOT NULL,
  jira_key TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (
    content_type IN ('ticket', 'prd', 'qa_report', 'implementation')
  ),
  content TEXT NOT NULL,
  embedding vector(1536) NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vector_store_embedding_idx
  ON vector_store
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS vector_store_content_type_idx
  ON vector_store (content_type);

CREATE INDEX IF NOT EXISTS vector_store_jira_key_idx
  ON vector_store (jira_key);

ALTER TABLE vector_store
  ADD CONSTRAINT vector_store_ticket_type_unique
  UNIQUE (jira_ticket_id, content_type);

CREATE OR REPLACE FUNCTION upsert_vector(
  p_jira_ticket_id TEXT,
  p_jira_key TEXT,
  p_content_type TEXT,
  p_content TEXT,
  p_embedding TEXT,
  p_metadata JSONB
) RETURNS VOID AS $$
BEGIN
  INSERT INTO vector_store (
    jira_ticket_id, jira_key, content_type, content, embedding, metadata
  )
  VALUES (
    p_jira_ticket_id,
    p_jira_key,
    p_content_type,
    p_content,
    p_embedding::vector,
    p_metadata
  )
  ON CONFLICT (jira_ticket_id, content_type)
  DO UPDATE SET
    content = EXCLUDED.content,
    embedding = EXCLUDED.embedding,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION similarity_search(
  query_embedding TEXT,
  content_types TEXT[],
  top_k INT,
  similarity_threshold FLOAT,
  exclude_keys TEXT[]
)
RETURNS TABLE (
  id UUID,
  jira_ticket_id TEXT,
  jira_key TEXT,
  content_type TEXT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
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
    1 - (vs.embedding <=> query_embedding::vector) AS similarity
  FROM vector_store vs
  WHERE
    vs.content_type = ANY(content_types)
    AND vs.jira_key != ALL(COALESCE(exclude_keys, ARRAY[]::TEXT[]))
    AND 1 - (vs.embedding <=> query_embedding::vector) >= similarity_threshold
  ORDER BY vs.embedding <=> query_embedding::vector
  LIMIT top_k;
END;
$$ LANGUAGE plpgsql;
```

**Codebase intelligence embeddings** (separate from pipeline `vector_store`) — required for semantic search, Ask, and per-file embedding writes during indexing:

1. Supabase Dashboard → **SQL Editor** → **New query**
2. Paste and run the full script from [`sql/codebase_embeddings.sql`](sql/codebase_embeddings.sql)

That creates `public.codebase_embeddings` and the `search_codebase` RPC. Without it, indexing still saves file metadata to Postgres, but search/Ask will not find semantic matches.

### OpenAI (GPT-5.1)

Set `OPENAI_API_KEY` in `server/.env`. All chat completions default to `gpt-5.1`; override with `OPENAI_CHAT_MODEL` if needed.

Run the API (indexing and pipelines run in-process on the same process):

```bash
npm run dev      # Express + REST endpoints + background tasks
```

## Endpoints

| Method | Path                                | Purpose                                            |
| ------ | ----------------------------------- | -------------------------------------------------- |
| GET    | `/healthz`                          | Liveness                                           |
| GET    | `/readyz`                           | Postgres readiness                                 |
| POST   | `/webhooks/jira`                    | Jira `issue_created` ingress                       |
| GET    | `/pipelines`                        | List recent pipelines                              |
| GET    | `/pipelines/:id`                    | Pipeline detail with stages, overrides, audit log  |
| POST   | `/pipelines/:ticketId/run`          | Manually enqueue a pipeline for a ticket           |
| POST   | `/pipelines/:pipelineId/override`   | Submit a human override for a stage and resume     |
| GET    | `/pipelines/:pipelineId/audit`      | Recent audit log entries                           |

## Pipeline stages

`INGESTION → PRODUCT_AGENT → PRD_VALIDATION → ENGINEERING_AGENT →
IMPLEMENTATION_VALIDATION → QA_AGENT → QA_VALIDATION → OUTPUT`

Each transition is enforced by `stateManager`, every agent call and gate
result is recorded in `AuditLog`, and any failed gate pauses the pipeline
and sets the ticket status to `AWAITING_HUMAN` until an override resumes it.

## Layer 2 (RAG)

- `vectorStore.ts`: Supabase RPC wrapper around `vector_store`
- `embedder.ts`: stage-specific ticket / PRD / implementation / QA embedding
- `retriever.ts`: stage-aware retrieval configs for Product, Engineering, QA
- `contextCompressor.ts`: token-budgeted compression of retrieved context
- `indexer.ts`: orchestration-friendly indexing wrappers

## Verification

```bash
npm run typecheck
npm run build
```

## Automatic pipeline deployment (Render)

### Required environment variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Postgres for pipelines, org intelligence |
| `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` | Vector store (RAG + org intelligence) |
| `OPENAI_API_KEY` | Agent reasoning and embeddings |
| `PUBLIC_API_URL` | Public URL for Jira webhooks |
| `PIPELINE_COMPLETION_STATUS` | Default Jira status after pipeline (e.g. `Done`) |
| `PIPELINE_INTAKE_POLL_MS` | AI Worker scan interval (default `120000`) |

### Deploy steps

1. Merge to `main` and deploy `agentos-api` via [`render.yaml`](render.yaml).
2. Run `npx prisma migrate deploy` against production Postgres.
3. In **Jira Integration**: connect Jira, map AI Worker column, set completion status via `PUT /pipeline-jira/completion-settings`.
4. Register webhook (automatic on connect when `PUBLIC_API_URL` is set).

### Post-deploy smoke test

1. Move a test ticket into the AI Worker column — it should enqueue within 2 minutes (webhook or intake poll).
2. Confirm **Pipeline Queue** shows one active ticket, others FIFO-queued.
3. On completion: Jira receives PRD/QA/RCA comments, description update, and status transition.
4. Check `/healthz` for `pipelineQueue` stats.
5. Open **QA Center** and **Org Intelligence** for test cases and learning signals.

### SQLite persistence

Pipeline queue state and Jira completion settings persist in the intake SQLite DB (`pipeline_queue_items`, `completion_settings_json`).
