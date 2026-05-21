# Called by npm run dev in server/ (port already freed by root scripts/start.ps1).
Set-Location $PSScriptRoot\..
$port = if ($env:PORT) { $env:PORT } else { 4000 }
Write-Host "Starting agentos API on port $port..."
npm run dev:tsx
