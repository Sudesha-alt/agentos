# Baseline an existing Supabase/Postgres DB that already has tables but no Prisma migration history.
# Fixes: Error P3005 — The database schema is not empty
#
# Prerequisites:
#   - DATABASE_URL in server/.env (Supabase direct connection, port 5432)
#   - Tables already created (via earlier prisma db push, manual SQL, or Supabase)
#
# Usage (from server/):
#   powershell -ExecutionPolicy Bypass -File scripts/baseline-prisma.ps1

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot/..

Write-Host "Marking 0_init as applied (existing schema baseline)..."
npx prisma migrate resolve --applied 0_init

Write-Host "Marking github_integration as applied..."
npx prisma migrate resolve --applied 20250606120000_github_integration

Write-Host ""
Write-Host "Done. Verify with: npx prisma migrate deploy"
Write-Host "It should report: No pending migrations to apply."
Write-Host ""
Write-Host "If GithubInstallation table is missing, run this SQL in Supabase first:"
Write-Host "  prisma/migrations/20250606120000_github_integration/migration.sql"
