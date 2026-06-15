-- Atlassian OAuth 3LO fields on org-scoped Jira config
ALTER TABLE "OrganizationJiraConfig"
  ADD COLUMN IF NOT EXISTS "authMethod" TEXT NOT NULL DEFAULT 'api_token',
  ADD COLUMN IF NOT EXISTS "cloudId" TEXT,
  ADD COLUMN IF NOT EXISTS "accessToken" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "refreshToken" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "tokenExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "scopes" TEXT NOT NULL DEFAULT '';
