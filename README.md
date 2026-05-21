# Agentos — Workflow Intelligence Layer

A multi-AI agent SaaS for software teams. Listens to Jira ticket creation,
runs the ticket through three agents (Product → Engineering → QA) with a
validation gate between each handoff, writes the output back to Jira, and
keeps a human in control at every step.

This repository contains both halves of the product:

- **Marketing site** (`/`) — Awwwards-style React landing page
- **Product app** (`/app/*`) — dashboard, pipelines, **AI Worker queue**, **board search**, settings
- **Backend** (`server/`) — Express + BullMQ orchestrator that runs the agents

## Stack

- React + Vite + Tailwind CSS + Framer Motion + Lenis (frontend)
- React Router (marketing + product app share the same Vite project)
- Node.js + TypeScript + Express + Prisma + Postgres (pgvector) + Redis + BullMQ (backend)
- Anthropic Claude Sonnet 4 + OpenAI embeddings (model layer)

## Run locally

```bash
# 1. Frontend (marketing + product app)
npm install
npm run dev
# → http://localhost:5173/      marketing
# → http://localhost:5173/app   product app (uses mock data if backend is down)

# 2. Backend (orchestration engine)
cd server
cp .env.example .env       # fill in DATABASE_URL, REDIS_URL, ANTHROPIC_API_KEY, OPENAI_API_KEY, JIRA_*
npm install
npm run prisma:generate
npm run prisma:migrate     # then run the pgvector ALTER from server/README.md
npm run dev                # Express on :4000
npm run worker             # BullMQ pipeline worker
```

The Vite dev server proxies `/api/*` to `http://localhost:4000`, so the
product UI just calls `/api/pipelines`, etc. If the backend isn't running,
the product UI falls back to an in-memory mock and shows a "Mock backend"
indicator in the top bar.

**Jira intake pages** (`/app/ai-worker`, `/app/jira-search`) call a separate
Jira Webhook intake service on port **3000** via the `/jira-intake` proxy.
See [INTEGRATION.md](./INTEGRATION.md).

## Layout

```
src/
  pages/Marketing.jsx        # marketing landing page (the original /)
  app/                       # product app at /app/*
    layout/AppShell, Sidebar, TopBar
    pages/Dashboard, Pipelines, PipelineDetail, Override, Settings
    components/StatusPill, StageTimeline, ValidationCard, AuditTimeline, JsonViewer, ...
    hooks/useApi              # polling-aware data fetching
    api/client, mock          # API client + offline mock
  sections/                  # marketing sections (Hero, Pipeline, Validation, ...)
  components/                # marketing components (HeroPipeline, Navigation, ...)
server/                      # backend (see server/README.md)
```

## Verify

```bash
npm run lint
npm run build
```
