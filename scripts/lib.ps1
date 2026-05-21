function Stop-ListenPort {
    param([int]$Port)
    $conns = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    foreach ($c in $conns) {
        $processId = $c.OwningProcess
        if ($processId -and $processId -ne 0) {
            Write-Host "  Stopping PID $processId on port $Port"
            Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
        }
    }
}

function Find-NgrokExe {
    $winget = Join-Path $env:LOCALAPPDATA `
        "Microsoft\WinGet\Packages\Ngrok.Ngrok_Microsoft.Winget.Source_8wekyb3d8bbwe\ngrok.exe"
    if (Test-Path $winget) { return $winget }
    $cmd = Get-Command ngrok -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

function Ensure-ServerEnv {
    param([string]$Root)
    $serverEnv = Join-Path $Root "server\.env"
    $example = Join-Path $Root "server\.env.example"
    $legacyEnv = "D:\Jira Webhook\.env"

    if (-not (Test-Path $serverEnv)) {
        if (Test-Path $legacyEnv) {
            Write-Host "  Creating server/.env from Jira Webhook/.env"
            Copy-Item $legacyEnv $serverEnv
        } elseif (Test-Path $example) {
            Write-Host "  Creating server/.env from .env.example"
            Copy-Item $example $serverEnv
        }
    }

    if (-not (Test-Path $serverEnv)) {
        Write-Host "  ERROR: Missing server/.env - copy server/.env.example and add Jira credentials." -ForegroundColor Red
        exit 1
    }

    $content = Get-Content $serverEnv -Raw
    $content = $content -replace '(?m)^PORT=.*$', 'PORT=4000'
    if ($content -notmatch '(?m)^PORT=') { $content += "`nPORT=4000" }
    $content = $content -replace '(?m)^SQLITE_PATH=.*$', 'SQLITE_PATH=./data/jira-intake.db'
    if ($content -notmatch '(?m)^SQLITE_PATH=') { $content += "`nSQLITE_PATH=./data/jira-intake.db" }
    if ($content -notmatch '(?m)^AI_WORKER_STATUSES=') { $content += "`nAI_WORKER_STATUSES=AI worker" }
    Set-Content -Path $serverEnv -Value $content.TrimEnd() -NoNewline
    Add-Content -Path $serverEnv -Value "`n"
}

function Sync-IntakeDatabase {
    param([string]$Root)
    $legacyDb = "D:\Jira Webhook\data\jira.db"
    $targetDir = Join-Path $Root "server\data"
    $targetDb = Join-Path $targetDir "jira-intake.db"
    if (-not (Test-Path $legacyDb)) { return }
    New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
    if (-not (Test-Path $targetDb)) {
        Write-Host "  Copying existing queue DB to server/data/jira-intake.db"
        Copy-Item $legacyDb $targetDb -Force
    }
}
