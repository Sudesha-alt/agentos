ALTER TABLE "OrganizationJiraConfig" ADD COLUMN IF NOT EXISTS "referenceColumnNamesJson" JSONB;
ALTER TABLE "OrganizationJiraConfig" ADD COLUMN IF NOT EXISTS "referenceStatusesJson" JSONB;
