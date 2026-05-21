# Agentos quick start (AI Worker + board search)

## Run (one terminal)

```powershell
cd d:\agentos
npm run dev
```

Open:

- http://localhost:5173/app/ai-worker
- http://localhost:5173/app/jira-search

## Expose to Jira (second terminal)

```powershell
cd d:\agentos
npm run tunnel
```

Set Jira webhook URL to: `https://<ngrok-host>/webhooks/jira`  
Events: **Issue updated** (and **Issue created** if needed).

## Do not run at the same time

- `d:\Jira Webhook` on port **3000** (old standalone app)
- Only use **agentos** on port **4000**

The start script stops port 3000 automatically.

## Config

Jira credentials live in `server/.env` (copied from `Jira Webhook/.env` on first run if missing).
