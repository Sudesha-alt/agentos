-- Idempotent: safe to re-run after a partial apply (enum exists but migration marked failed).

DO $$ BEGIN
  CREATE TYPE "PipelineQueueStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "PipelineQueueItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "jiraKey" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "status" "PipelineQueueStatus" NOT NULL DEFAULT 'PENDING',
    "enqueuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "PipelineQueueItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "IntakeEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jiraKey" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "skipReason" TEXT,
    "message" TEXT,
    "summary" TEXT,
    "issueType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntakeEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PipelineQueueItem_organizationId_status_position_idx" ON "PipelineQueueItem"("organizationId", "status", "position");

CREATE INDEX IF NOT EXISTS "PipelineQueueItem_organizationId_jiraKey_idx" ON "PipelineQueueItem"("organizationId", "jiraKey");

CREATE INDEX IF NOT EXISTS "PipelineQueueItem_ticketId_idx" ON "PipelineQueueItem"("ticketId");

CREATE INDEX IF NOT EXISTS "IntakeEvent_organizationId_createdAt_idx" ON "IntakeEvent"("organizationId", "createdAt");

CREATE INDEX IF NOT EXISTS "IntakeEvent_organizationId_jiraKey_idx" ON "IntakeEvent"("organizationId", "jiraKey");

DO $$ BEGIN
  ALTER TABLE "PipelineQueueItem" ADD CONSTRAINT "PipelineQueueItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "IntakeEvent" ADD CONSTRAINT "IntakeEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
