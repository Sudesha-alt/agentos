# Jira intake (built into agentos)

AI Worker queue and board keyword search run **inside the agentos server** on port **4000**. You do not need the separate `d:\Jira Webhook` service for the product UI.

| Page | Route | Backend (via `/jira-intake` proxy) |
|------|-------|-------------------------------------|
| AI Worker queue | `/app/ai-worker` | `GET /ai-worker/issues` |
| Board search | `/app/jira-search` | `GET /boards/search` |

The standalone project at `d:\Jira Webhook` is unchanged and can still be used on its own.

## Run agentos (one command)

```bash
cd d:\agentos
npm install
cd server && npm install && cd ..
npm run dev
```

This starts:

- **Vite** on http://localhost:5173 (UI)
- **API** on http://localhost:4000 (pipelines + Jira intake)

Open:

- http://localhost:5173/app/ai-worker
- http://localhost:5173/app/jira-search

### First-time server setup

Copy Jira credentials into `server/.env` (from your standalone `Jira Webhook/.env` or `server/.env.example`):

- `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_BOARD_ID`
- `AI_WORKER_STATUSES` (e.g. `AI Worker`)

Pipelines also need `DATABASE_URL`, `REDIS_URL`, and model keys. Intake pages work without Postgres.

To reuse an existing AI Worker SQLite database, copy `Jira Webhook/data/jira.db` to `server/data/jira-intake.db`.

### Optional: pipeline worker

```bash
npm run dev:worker
```

Requires Postgres, Redis, and model keys in `server/.env`.

## Configure `server/.env`

Copy from `server/.env.example`. For intake pages you need at least:

```env
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=you@example.com
JIRA_API_TOKEN=...
JIRA_BOARD_ID=1
AI_WORKER_STATUSES=AI Worker
```

Board search uses the Jira REST API. The AI Worker queue uses SQLite at `server/data/jira-intake.db` by default.

## Jira webhooks (one URL on port 4000)

Use the **same path as before**: `POST /webhooks/jira`

| Event | Handler |
|-------|---------|
| `jira:issue_created` | Agent pipeline (optional `x-agentos-secret`) |
| `jira:issue_updated` (column moves) | AI Worker SQLite queue |

**ngrok must target port 4000**, not 3000:

```bash
cd d:\agentos
npm run tunnel
# Jira webhook URL: https://<ngrok-host>/webhooks/jira
```

Stop the standalone `d:\Jira Webhook` service on :3000 if you use agentos, or webhooks will update the wrong database.

## Code layout

```
server/src/jira-intake/     SQLite store, Jira API, board search
server/src/api/routes/jiraIntake.ts
src/entities/jira-intake/   Frontend API client
src/app/pages/AiWorker.jsx
src/app/pages/JiraSearch.jsx
vite.config.js              /jira-intake → :4000
```
