# Jira Webhook integration (agentos UI)

The product app includes two pages wired to the separate **Jira Webhook** service (`d:\Jira Webhook` or any host on port **3000**):

| Page | Route | Backend |
|------|-------|---------|
| AI Worker queue | `/app/ai-worker` | `GET /jira-intake/ai-worker/issues` |
| Board search | `/app/jira-search` | `GET /jira-intake/boards/search` |

Vite proxies `/jira-intake/*` → `http://localhost:3000/*` (override with `VITE_JIRA_INTAKE_URL` in `.env`).

## Run everything locally

```bash
# Terminal 1 — Jira Webhook intake service
cd "d:\Jira Webhook"
npm start
# optional: npm run tunnel  → ngrok for Jira webhooks

# Terminal 2 — Agentos frontend
cd d:\agentos
npm install
npm run dev
# → http://localhost:5173/app/ai-worker
# → http://localhost:5173/app/jira-search

# Terminal 3 — Agentos backend (pipelines; optional for intake pages)
cd d:\agentos\server
npm run dev

# Terminal 4 — BullMQ worker (optional)
cd d:\agentos\server
npm run worker
```

## Jira webhooks (two services)

| Purpose | URL |
|---------|-----|
| **AI Worker column intake** (your service) | `https://<ngrok>/webhooks/jira` → port **3000** |
| **Agent pipeline** (agentos server) | `https://<host>/api/webhooks/jira` → port **4000** |

Do not point both to the same URL unless you merge handlers.

## Files added

- `src/entities/jira-intake/index.js` — API client
- `src/app/pages/AiWorker.jsx`
- `src/app/pages/JiraSearch.jsx`
- `src/shared/config/app.ts` — nav entries
- `vite.config.js` — `/jira-intake` proxy
