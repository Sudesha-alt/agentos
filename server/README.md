# Agentos Server — Phase 1

Multi-AI agent orchestration engine. A Jira ticket arrives via webhook, passes
through three agents in sequence (Product → Engineering → QA) with a
validation gate between each handoff, and is written back to Jira. A human is
in control at every stage transition.

## Stack

- Node.js + TypeScript, Express
- PostgreSQL (Supabase) with `pgvector`
- Prisma ORM
- Redis + BullMQ for the pipeline worker
- Anthropic Claude Sonnet 4 (direct API or **AWS Bedrock**) for agent reasoning
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
  queue/         jobQueue + workers/pipelineWorker
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
# fill in DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_KEY, REDIS_URL,
# LLM_PROVIDER + (ANTHROPIC_API_KEY or AWS Bedrock creds), OPENAI_API_KEY, JIRA_*

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

### AWS Bedrock (Claude agents)

1. In [Amazon Bedrock console](https://console.aws.amazon.com/bedrock/), enable **Claude Sonnet 4** (or your chosen model) for your region.
2. In `server/.env`:

```ini
LLM_PROVIDER=bedrock
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-sonnet-4-20250514-v1:0
```

Bedrock uses **IAM access keys** (or `~/.aws/credentials`), not an Anthropic API key. Model ids must match Bedrock’s `anthropic.*` inference profile for your region.

To keep using [console.anthropic.com](https://console.anthropic.com/) keys instead, leave `LLM_PROVIDER=anthropic` (default) and set `ANTHROPIC_API_KEY`.

Run the API and worker side by side:

```bash
npm run dev      # Express + REST endpoints
npm run worker   # BullMQ pipeline worker
```

## Endpoints

| Method | Path                                | Purpose                                            |
| ------ | ----------------------------------- | -------------------------------------------------- |
| GET    | `/healthz`                          | Liveness                                           |
| GET    | `/readyz`                           | Postgres + Redis readiness                         |
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
