# Jira intake (built into server)

AI Worker queue and board search run on the **server** (`server/`). The **app** (`app/`) calls them via `VITE_API_URL` in production or Vite proxy in dev.

| Page | App route | API |
|------|-----------|-----|
| AI Worker queue | `/app/ai-worker` | `GET /jira-intake/ai-worker/issues` |
| Board search | `/app/jira-search` | `GET /jira-intake/boards/search` |

## Local dev

```powershell
npm run dev
```

- App: http://localhost:5173/app/ai-worker  
- API: http://localhost:4000  

## Production

| Deploy | Root directory | Env |
|--------|----------------|-----|
| **Vercel** | `app` | `VITE_API_URL=https://agentos-sc05.onrender.com`, `VITE_API_MODE=rest` |
| **Render** | `server` | `CORS_ORIGIN=https://agentos-blue.vercel.app`, `FRONTEND_URL=https://agentos-blue.vercel.app`, `PUBLIC_API_URL=https://agentos-sc05.onrender.com` |

Pipelines need Postgres, Redis, and model keys on Render. Jira intake pages only need Jira vars + SQLite path (`SQLITE_PATH`).

## Webhook URL

`https://agentos-sc05.onrender.com/webhooks/jira`

- `issue_created` → agent pipeline (needs worker + Redis)  
- other events (e.g. `issue_updated`) → AI Worker SQLite queue  
