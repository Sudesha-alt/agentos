# One command to run agentos UI + API (Jira intake included).
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"

$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

Write-Host ""
Write-Host "=== Agentos dev ===" -ForegroundColor Cyan
Write-Host "Freeing ports 3000 (legacy), 4000 (API), 5173 (UI)..."
Stop-ListenPort 3000
Stop-ListenPort 4000
Stop-ListenPort 5173
Start-Sleep -Seconds 1

Ensure-ServerEnv -Root $Root
Sync-IntakeDatabase -Root $Root

if (-not (Test-Path "node_modules")) {
    Write-Host "Installing frontend dependencies..."
    npm install
}
if (-not (Test-Path "server\node_modules")) {
    Write-Host "Installing server dependencies..."
    npm install --prefix server
}

Write-Host ""
Write-Host "Starting API (:4000) then UI (:5173)..." -ForegroundColor Green
Write-Host "  App:     http://localhost:5173/app/ai-worker" -ForegroundColor DarkGray
Write-Host "  Webhook: http://localhost:4000/webhooks/jira (use npm run tunnel for Jira)" -ForegroundColor DarkGray
Write-Host ""

npx concurrently -n api,web -c magenta,blue `
    "npm run dev --prefix server" `
    "npx wait-on http://127.0.0.1:4000/health -t 90000 && npm run dev:web"
