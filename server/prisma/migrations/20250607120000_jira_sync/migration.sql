-- CreateEnum
CREATE TYPE "JiraSyncMode" AS ENUM ('FULL', 'INCREMENTAL');

-- CreateEnum
CREATE TYPE "JiraSyncStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "JiraIssue" (
    "id" TEXT NOT NULL,
    "jiraTicketId" TEXT NOT NULL,
    "jiraKey" TEXT NOT NULL,
    "projectKey" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "issueType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "priority" TEXT,
    "reporter" TEXT,
    "assignee" TEXT,
    "labels" JSONB NOT NULL DEFAULT '[]',
    "components" JSONB NOT NULL DEFAULT '[]',
    "commentsText" TEXT,
    "resolution" TEXT,
    "gitContext" TEXT,
    "rawPayload" JSONB,
    "jiraUpdatedAt" TIMESTAMP(3),
    "embeddedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JiraIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JiraSyncRun" (
    "id" TEXT NOT NULL,
    "mode" "JiraSyncMode" NOT NULL,
    "status" "JiraSyncStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "issuesSynced" INTEGER NOT NULL DEFAULT 0,
    "issuesSkipped" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "watermark" TIMESTAMP(3),

    CONSTRAINT "JiraSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JiraIssue_jiraTicketId_key" ON "JiraIssue"("jiraTicketId");

-- CreateIndex
CREATE UNIQUE INDEX "JiraIssue_jiraKey_key" ON "JiraIssue"("jiraKey");

-- CreateIndex
CREATE INDEX "JiraIssue_projectKey_status_idx" ON "JiraIssue"("projectKey", "status");

-- CreateIndex
CREATE INDEX "JiraIssue_jiraUpdatedAt_idx" ON "JiraIssue"("jiraUpdatedAt");

-- CreateIndex
CREATE INDEX "JiraIssue_isDeleted_idx" ON "JiraIssue"("isDeleted");

-- CreateIndex
CREATE INDEX "JiraSyncRun_status_startedAt_idx" ON "JiraSyncRun"("status", "startedAt");
