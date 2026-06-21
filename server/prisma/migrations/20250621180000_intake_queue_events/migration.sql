-- CreateEnum
CREATE TYPE "PipelineQueueStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "PipelineQueueItem" (
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

-- CreateTable
CREATE TABLE "IntakeEvent" (
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

-- CreateIndex
CREATE INDEX "PipelineQueueItem_organizationId_status_position_idx" ON "PipelineQueueItem"("organizationId", "status", "position");

-- CreateIndex
CREATE INDEX "PipelineQueueItem_organizationId_jiraKey_idx" ON "PipelineQueueItem"("organizationId", "jiraKey");

-- CreateIndex
CREATE INDEX "PipelineQueueItem_ticketId_idx" ON "PipelineQueueItem"("ticketId");

-- CreateIndex
CREATE INDEX "IntakeEvent_organizationId_createdAt_idx" ON "IntakeEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "IntakeEvent_organizationId_jiraKey_idx" ON "IntakeEvent"("organizationId", "jiraKey");

-- AddForeignKey
ALTER TABLE "PipelineQueueItem" ADD CONSTRAINT "PipelineQueueItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeEvent" ADD CONSTRAINT "IntakeEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
