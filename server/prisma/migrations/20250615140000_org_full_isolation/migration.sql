-- Full organization isolation: add organizationId to tenant-scoped tables and backfill legacy rows.
-- Safe to re-run: constraints use duplicate_object guards; columns/indexes use IF NOT EXISTS.

-- Ensure a default org exists for legacy single-tenant data.
INSERT INTO "Organization" ("id", "name", "slug", "domain", "createdAt", "updatedAt")
SELECT 'legacy-default-org', 'Legacy Workspace', 'legacy-workspace', 'legacy.local', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "Organization" LIMIT 1);

-- Ticket
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "Ticket" SET "organizationId" = (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "organizationId" IS NULL;
ALTER TABLE "Ticket" ALTER COLUMN "organizationId" SET NOT NULL;
DROP INDEX IF EXISTS "Ticket_jiraTicketId_key";
DO $$ BEGIN
  ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "Ticket_organizationId_jiraTicketId_key" ON "Ticket"("organizationId", "jiraTicketId");
CREATE UNIQUE INDEX IF NOT EXISTS "Ticket_organizationId_jiraKey_key" ON "Ticket"("organizationId", "jiraKey");
CREATE INDEX IF NOT EXISTS "Ticket_organizationId_idx" ON "Ticket"("organizationId");

-- JiraIssue
ALTER TABLE "JiraIssue" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "JiraIssue" SET "organizationId" = (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "organizationId" IS NULL;
ALTER TABLE "JiraIssue" ALTER COLUMN "organizationId" SET NOT NULL;
DROP INDEX IF EXISTS "JiraIssue_jiraTicketId_key";
DROP INDEX IF EXISTS "JiraIssue_jiraKey_key";
DO $$ BEGIN
  ALTER TABLE "JiraIssue" ADD CONSTRAINT "JiraIssue_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "JiraIssue_organizationId_jiraTicketId_key" ON "JiraIssue"("organizationId", "jiraTicketId");
CREATE UNIQUE INDEX IF NOT EXISTS "JiraIssue_organizationId_jiraKey_key" ON "JiraIssue"("organizationId", "jiraKey");
CREATE INDEX IF NOT EXISTS "JiraIssue_organizationId_idx" ON "JiraIssue"("organizationId");

-- JiraSyncRun
ALTER TABLE "JiraSyncRun" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "JiraSyncRun" SET "organizationId" = (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "organizationId" IS NULL;
ALTER TABLE "JiraSyncRun" ALTER COLUMN "organizationId" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "JiraSyncRun" ADD CONSTRAINT "JiraSyncRun_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "JiraSyncRun_organizationId_status_startedAt_idx" ON "JiraSyncRun"("organizationId", "status", "startedAt");

-- JiraMirror
ALTER TABLE "JiraMirror" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "JiraMirror" SET "organizationId" = (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "organizationId" IS NULL;
ALTER TABLE "JiraMirror" ALTER COLUMN "organizationId" SET NOT NULL;
DROP INDEX IF EXISTS "JiraMirror_jiraTicketId_key";
DROP INDEX IF EXISTS "JiraMirror_jiraKey_key";
DO $$ BEGIN
  ALTER TABLE "JiraMirror" ADD CONSTRAINT "JiraMirror_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "JiraMirror_organizationId_jiraTicketId_key" ON "JiraMirror"("organizationId", "jiraTicketId");
CREATE UNIQUE INDEX IF NOT EXISTS "JiraMirror_organizationId_jiraKey_key" ON "JiraMirror"("organizationId", "jiraKey");
CREATE INDEX IF NOT EXISTS "JiraMirror_organizationId_idx" ON "JiraMirror"("organizationId");

-- Pipeline
ALTER TABLE "Pipeline" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "Pipeline" p SET "organizationId" = t."organizationId"
FROM "Ticket" t WHERE p."ticketId" = t."id" AND p."organizationId" IS NULL;
UPDATE "Pipeline" SET "organizationId" = (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "organizationId" IS NULL;
ALTER TABLE "Pipeline" ALTER COLUMN "organizationId" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "Pipeline" ADD CONSTRAINT "Pipeline_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "Pipeline_organizationId_idx" ON "Pipeline"("organizationId");

-- OrgIntelligenceRecord
ALTER TABLE "OrgIntelligenceRecord" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "OrgIntelligenceRecord" SET "organizationId" = (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "organizationId" IS NULL;
ALTER TABLE "OrgIntelligenceRecord" ALTER COLUMN "organizationId" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "OrgIntelligenceRecord" ADD CONSTRAINT "OrgIntelligenceRecord_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "OrgIntelligenceRecord_organizationId_idx" ON "OrgIntelligenceRecord"("organizationId");
CREATE INDEX IF NOT EXISTS "OrgIntelligenceRecord_organizationId_jiraKey_createdAt_idx"
  ON "OrgIntelligenceRecord"("organizationId", "jiraKey", "createdAt");

-- AgentChatThread
ALTER TABLE "AgentChatThread" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
DO $$ BEGIN
  ALTER TABLE "AgentChatThread" ADD CONSTRAINT "AgentChatThread_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
DROP INDEX IF EXISTS "AgentChatThread_agentDomain_contextKey_key";
CREATE UNIQUE INDEX IF NOT EXISTS "AgentChatThread_organizationId_agentDomain_contextKey_key"
  ON "AgentChatThread"("organizationId", "agentDomain", "contextKey");
CREATE INDEX IF NOT EXISTS "AgentChatThread_organizationId_agentDomain_idx"
  ON "AgentChatThread"("organizationId", "agentDomain");

-- Codebase tables
ALTER TABLE "CodebaseVisualizationCache" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "CodebaseVisualizationCache" SET "organizationId" = (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "organizationId" IS NULL;
ALTER TABLE "CodebaseVisualizationCache" ALTER COLUMN "organizationId" SET NOT NULL;
DROP INDEX IF EXISTS "CodebaseVisualizationCache_repoOwner_repoName_branchName_key";
DO $$ BEGIN
  ALTER TABLE "CodebaseVisualizationCache" ADD CONSTRAINT "CodebaseVisualizationCache_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "CodebaseVisualizationCache_organizationId_repoOwner_repoName_branchName_key"
  ON "CodebaseVisualizationCache"("organizationId", "repoOwner", "repoName", "branchName");

ALTER TABLE "CodebaseTourCache" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "CodebaseTourCache" SET "organizationId" = (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "organizationId" IS NULL;
ALTER TABLE "CodebaseTourCache" ALTER COLUMN "organizationId" SET NOT NULL;
DROP INDEX IF EXISTS "CodebaseTourCache_repoOwner_repoName_branchName_key";
DO $$ BEGIN
  ALTER TABLE "CodebaseTourCache" ADD CONSTRAINT "CodebaseTourCache_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "CodebaseTourCache_organizationId_repoOwner_repoName_branchName_key"
  ON "CodebaseTourCache"("organizationId", "repoOwner", "repoName", "branchName");

ALTER TABLE "CodebaseKnowledgeCache" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "CodebaseKnowledgeCache" SET "organizationId" = (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "organizationId" IS NULL;
ALTER TABLE "CodebaseKnowledgeCache" ALTER COLUMN "organizationId" SET NOT NULL;
DROP INDEX IF EXISTS "CodebaseKnowledgeCache_repoOwner_repoName_branchName_key";
DO $$ BEGIN
  ALTER TABLE "CodebaseKnowledgeCache" ADD CONSTRAINT "CodebaseKnowledgeCache_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "CodebaseKnowledgeCache_organizationId_repoOwner_repoName_branchName_key"
  ON "CodebaseKnowledgeCache"("organizationId", "repoOwner", "repoName", "branchName");

ALTER TABLE "CodebaseFile" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "CodebaseFile" SET "organizationId" = (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "organizationId" IS NULL;
ALTER TABLE "CodebaseFile" ALTER COLUMN "organizationId" SET NOT NULL;
DROP INDEX IF EXISTS "CodebaseFile_repoOwner_repoName_filePath_branchName_key";
DO $$ BEGIN
  ALTER TABLE "CodebaseFile" ADD CONSTRAINT "CodebaseFile_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "CodebaseFile_organizationId_repoOwner_repoName_filePath_branchName_key"
  ON "CodebaseFile"("organizationId", "repoOwner", "repoName", "filePath", "branchName");
CREATE INDEX IF NOT EXISTS "CodebaseFile_organizationId_repoOwner_repoName_branchName_idx"
  ON "CodebaseFile"("organizationId", "repoOwner", "repoName", "branchName");

ALTER TABLE "BranchState" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "BranchState" SET "organizationId" = (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "organizationId" IS NULL;
ALTER TABLE "BranchState" ALTER COLUMN "organizationId" SET NOT NULL;
DROP INDEX IF EXISTS "BranchState_repoOwner_repoName_branchName_key";
DO $$ BEGIN
  ALTER TABLE "BranchState" ADD CONSTRAINT "BranchState_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "BranchState_organizationId_repoOwner_repoName_branchName_key"
  ON "BranchState"("organizationId", "repoOwner", "repoName", "branchName");

ALTER TABLE "CommitHistory" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "CommitHistory" SET "organizationId" = (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "organizationId" IS NULL;
ALTER TABLE "CommitHistory" ALTER COLUMN "organizationId" SET NOT NULL;
DROP INDEX IF EXISTS "CommitHistory_repoOwner_repoName_sha_key";
DO $$ BEGIN
  ALTER TABLE "CommitHistory" ADD CONSTRAINT "CommitHistory_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "CommitHistory_organizationId_repoOwner_repoName_sha_key"
  ON "CommitHistory"("organizationId", "repoOwner", "repoName", "sha");

ALTER TABLE "CodebaseIndexRun" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "CodebaseIndexRun" SET "organizationId" = (SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "organizationId" IS NULL;
ALTER TABLE "CodebaseIndexRun" ALTER COLUMN "organizationId" SET NOT NULL;
DO $$ BEGIN
  ALTER TABLE "CodebaseIndexRun" ADD CONSTRAINT "CodebaseIndexRun_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "CodebaseIndexRun_organizationId_repoOwner_repoName_status_idx"
  ON "CodebaseIndexRun"("organizationId", "repoOwner", "repoName", "status");

-- WorkspaceBilling: migrate from singleton id to per-org
ALTER TABLE "WorkspaceBilling" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
UPDATE "WorkspaceBilling" wb SET "organizationId" = (
  SELECT "id" FROM "Organization" ORDER BY "createdAt" ASC LIMIT 1
) WHERE wb."organizationId" IS NULL;
INSERT INTO "WorkspaceBilling" ("id", "organizationId", "planId", "runsUsed", "runsCap", "pilotEndsAt", "billingCycle", "updatedAt")
SELECT concat('billing-', o."id"), o."id", 'pilot', 0, 20, NULL, 'monthly', NOW()
FROM "Organization" o
WHERE NOT EXISTS (SELECT 1 FROM "WorkspaceBilling" wb WHERE wb."organizationId" = o."id");
ALTER TABLE "WorkspaceBilling" ALTER COLUMN "organizationId" SET NOT NULL;
DROP INDEX IF EXISTS "WorkspaceBilling_organizationId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "WorkspaceBilling_organizationId_key" ON "WorkspaceBilling"("organizationId");
DO $$ BEGIN
  ALTER TABLE "WorkspaceBilling" ADD CONSTRAINT "WorkspaceBilling_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- GithubInstallation
ALTER TABLE "GithubInstallation" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;
DO $$ BEGIN
  ALTER TABLE "GithubInstallation" ADD CONSTRAINT "GithubInstallation_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
CREATE INDEX IF NOT EXISTS "GithubInstallation_organizationId_idx" ON "GithubInstallation"("organizationId");
