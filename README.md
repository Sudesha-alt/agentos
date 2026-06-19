# Agentos — Workflow Intelligence Layer

Multi-AI agent SaaS: Jira → Product → Engineering → QA, with human gates and Jira intake (AI Worker queue + board search).

## Repository layout

```
agentos/
  app/          # React + Vite → deploy to Vercel (root directory: app)
  server/       # Express + Prisma + Jira intake → deploy to Render
  scripts/      # Local dev helpers (start.ps1, tunnel.ps1)
```

| Folder | Host | Purpose |
|--------|------|---------|
| **app** | [Vercel](https://vercel.com) | Marketing site + product UI (`/app/*`) |
| **server** | [Render](https://render.com) | API, webhooks, Jira intake, in-process indexing |

## Local development

```powershell
# Install both packages
npm run install:all

# API + app (from repo root)
npm run dev

# Optional: ngrok for Jira webhooks
npm run tunnel
```

- App: http://localhost:5173  
- API: http://localhost:4000  
- Copy `server/.env.example` → `server/.env` and `app/.env.example` → `app/.env`

In **app/.env** for local dev you can omit `VITE_API_URL` (Vite proxies `/api` and `/jira-intake` to :4000).

## Production deployment

### 1. Render (server)

1. New **Web Service** → connect repo → **Root Directory**: `server`
2. Build: `npm install && npm run build`  
   Start: `npm start`  
   Health check path: `/healthz`
3. Add env from `server/.env.example` (Jira, Supabase, Redis, models, etc.)
4. Set **`CORS_ORIGIN`** and **`FRONTEND_URL`** to your Vercel URL, e.g. `https://agentos-blue.vercel.app`
5. Set **`PUBLIC_API_URL`** to your Render URL, e.g. `https://agentos-sc05.onrender.com`
6. Optional: add **Background Worker** with root `server`, start `npm run worker`

Copy your Render URL, e.g. `https://agentos-sc05.onrender.com`.

### 2. Vercel (app)

1. New project → repo → **Root Directory**: `app`
2. Framework: Vite  
   Build: `npm run build`  
   Output: `dist`
3. Environment variables:

| Name | Value |
|------|--------|
| `VITE_API_URL` | `https://agentos-sc05.onrender.com` (your Render URL) |
| `VITE_API_MODE` | `rest` |

4. Redeploy after changing env vars.

### 3. Jira webhook

Point to: `https://<render-host>/webhooks/jira`

See [INTEGRATION.md](./INTEGRATION.md) and [server/README.md](./server/README.md).

**Pipeline demo:** [docs/DEMO_PIPELINE.md](./docs/DEMO_PIPELINE.md) — Horizon Commerce Jira CSV + demo codebase walkthrough.

## Verify

```powershell
npm run lint --prefix app
npm run test --prefix app
npm run build --prefix app
npm run typecheck --prefix server
```
