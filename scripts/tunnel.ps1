$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"

$port = if ($args[0]) { [int]$args[0] } else { 4000 }

$onApi = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if (-not $onApi) {
    Write-Host "ERROR: Nothing is listening on port $port." -ForegroundColor Red
    Write-Host "Start agentos first:  cd d:\agentos  &&  npm run dev" -ForegroundColor Yellow
    exit 1
}

$ngrokExe = Find-NgrokExe
if (-not $ngrokExe) {
    Write-Host "ngrok not found. Install: winget install Ngrok.Ngrok" -ForegroundColor Red
    exit 1
}

Write-Host "Starting ngrok -> port $port" -ForegroundColor Cyan
Write-Host "Jira webhook URL: https://<ngrok-host>/webhooks/jira" -ForegroundColor Cyan
& $ngrokExe http $port
