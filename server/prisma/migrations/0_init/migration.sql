-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'AWAITING_HUMAN', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PipelineStage" AS ENUM ('INGESTION', 'PRODUCT_AGENT', 'PRD_VALIDATION', 'ENGINEERING_AGENT', 'IMPLEMENTATION_VALIDATION', 'QA_AGENT', 'QA_VALIDATION', 'OUTPUT');

-- CreateEnum
CREATE TYPE "PipelineStatus" AS ENUM ('RUNNING', 'PAUSED', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "StageStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'AWAITING_HUMAN');

-- CreateTable
CREATE TABLE "Ticket" (
    "id" TEXT NOT NULL,
    "jiraTicketId" TEXT NOT NULL,
    "jiraKey" TEXT NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "normalizedData" JSONB NOT NULL,
    "status" "TicketStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pipeline" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "currentStage" "PipelineStage" NOT NULL,
    "status" "PipelineStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Pipeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PipelineStageLog" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "stage" "PipelineStage" NOT NULL,
    "status" "StageStatus" NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "validationResult" JSONB,
    "confidenceScore" DOUBLE PRECISION,
    "tokenCount" INTEGER,
    "costUsd" DOUBLE PRECISION,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "PipelineStageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HumanOverride" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "stage" "PipelineStage" NOT NULL,
    "originalOutput" JSONB NOT NULL,
    "correctedOutput" JSONB NOT NULL,
    "reason" TEXT,
    "overriddenBy" TEXT NOT NULL,
    "overriddenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HumanOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodebaseVisualizationCache" (
    "id" TEXT NOT NULL,
    "repoOwner" TEXT NOT NULL,
    "repoName" TEXT NOT NULL,
    "branchName" TEXT NOT NULL,
    "layoutJson" JSONB NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodebaseVisualizationCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodebaseFile" (
    "id" TEXT NOT NULL,
    "repoOwner" TEXT NOT NULL,
    "repoName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "branchName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "language" TEXT,
    "summary" TEXT,
    "exports" JSONB NOT NULL,
    "imports" JSONB NOT NULL,
    "patterns" JSONB NOT NULL,
    "lastCommitSha" TEXT,
    "lastCommitMsg" TEXT,
    "lastCommitAt" TIMESTAMP(3),
    "lastAuthor" TEXT,
    "indexedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CodebaseFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BranchState" (
    "id" TEXT NOT NULL,
    "repoOwner" TEXT NOT NULL,
    "repoName" TEXT NOT NULL,
    "branchName" TEXT NOT NULL,
    "sourceBranch" TEXT NOT NULL,
    "jiraKey" TEXT,
    "createdBy" TEXT NOT NULL,
    "headSha" TEXT NOT NULL,
    "behindBy" INTEGER NOT NULL DEFAULT 0,
    "aheadBy" INTEGER NOT NULL DEFAULT 0,
    "prNumber" INTEGER,
    "prUrl" TEXT,
    "prStatus" TEXT,
    "filesChanged" JSONB NOT NULL,
    "lastPushAt" TIMESTAMP(3),
    "lastPushBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommitHistory" (
    "id" TEXT NOT NULL,
    "repoOwner" TEXT NOT NULL,
    "repoName" TEXT NOT NULL,
    "branchName" TEXT NOT NULL,
    "sha" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "authoredAt" TIMESTAMP(3) NOT NULL,
    "filesAdded" JSONB NOT NULL,
    "filesModified" JSONB NOT NULL,
    "filesDeleted" JSONB NOT NULL,
    "pushedBy" TEXT NOT NULL,
    "pipelineId" TEXT,
    "jiraKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommitHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodebaseIndexRun" (
    "id" TEXT NOT NULL,
    "repoOwner" TEXT NOT NULL,
    "repoName" TEXT NOT NULL,
    "branchName" TEXT NOT NULL,
    "runType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "filesTotal" INTEGER NOT NULL DEFAULT 0,
    "filesProcessed" INTEGER NOT NULL DEFAULT 0,
    "filesIndexed" INTEGER NOT NULL DEFAULT 0,
    "filesUpdated" INTEGER NOT NULL DEFAULT 0,
    "filesDeleted" INTEGER NOT NULL DEFAULT 0,
    "triggerType" TEXT NOT NULL,
    "triggerSha" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "CodebaseIndexRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GithubInstallation" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "accountLogin" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "targetType" TEXT,
    "permissionsJson" JSONB,
    "eventsJson" JSONB,
    "suspendedAt" TIMESTAMP(3),
    "selectedRepoOwner" TEXT,
    "selectedRepoName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GithubInstallation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GithubRepository" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "githubRepoId" INTEGER NOT NULL,
    "owner" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "defaultBranch" TEXT NOT NULL DEFAULT 'main',
    "private" BOOLEAN NOT NULL DEFAULT false,
    "selected" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GithubRepository_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_jiraTicketId_key" ON "Ticket"("jiraTicketId");

-- CreateIndex
CREATE UNIQUE INDEX "Pipeline_ticketId_key" ON "Pipeline"("ticketId");

-- CreateIndex
CREATE INDEX "PipelineStageLog_pipelineId_stage_idx" ON "PipelineStageLog"("pipelineId", "stage");

-- CreateIndex
CREATE INDEX "HumanOverride_pipelineId_stage_idx" ON "HumanOverride"("pipelineId", "stage");

-- CreateIndex
CREATE INDEX "AuditLog_pipelineId_timestamp_idx" ON "AuditLog"("pipelineId", "timestamp");

-- CreateIndex
CREATE INDEX "CodebaseVisualizationCache_computedAt_idx" ON "CodebaseVisualizationCache"("computedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CodebaseVisualizationCache_repoOwner_repoName_branchName_key" ON "CodebaseVisualizationCache"("repoOwner", "repoName", "branchName");

-- CreateIndex
CREATE INDEX "CodebaseFile_repoOwner_repoName_branchName_idx" ON "CodebaseFile"("repoOwner", "repoName", "branchName");

-- CreateIndex
CREATE INDEX "CodebaseFile_language_idx" ON "CodebaseFile"("language");

-- CreateIndex
CREATE INDEX "CodebaseFile_contentHash_idx" ON "CodebaseFile"("contentHash");

-- CreateIndex
CREATE UNIQUE INDEX "CodebaseFile_repoOwner_repoName_filePath_branchName_key" ON "CodebaseFile"("repoOwner", "repoName", "filePath", "branchName");

-- CreateIndex
CREATE INDEX "BranchState_jiraKey_idx" ON "BranchState"("jiraKey");

-- CreateIndex
CREATE UNIQUE INDEX "BranchState_repoOwner_repoName_branchName_key" ON "BranchState"("repoOwner", "repoName", "branchName");

-- CreateIndex
CREATE INDEX "CommitHistory_branchName_idx" ON "CommitHistory"("branchName");

-- CreateIndex
CREATE INDEX "CommitHistory_jiraKey_idx" ON "CommitHistory"("jiraKey");

-- CreateIndex
CREATE UNIQUE INDEX "CommitHistory_repoOwner_repoName_sha_key" ON "CommitHistory"("repoOwner", "repoName", "sha");

-- CreateIndex
CREATE INDEX "CodebaseIndexRun_repoOwner_repoName_status_idx" ON "CodebaseIndexRun"("repoOwner", "repoName", "status");

-- CreateIndex
CREATE INDEX "CodebaseIndexRun_startedAt_idx" ON "CodebaseIndexRun"("startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "GithubInstallation_installationId_key" ON "GithubInstallation"("installationId");

-- CreateIndex
CREATE INDEX "GithubInstallation_accountLogin_idx" ON "GithubInstallation"("accountLogin");

-- CreateIndex
CREATE INDEX "GithubRepository_fullName_idx" ON "GithubRepository"("fullName");

-- CreateIndex
CREATE INDEX "GithubRepository_installationId_selected_idx" ON "GithubRepository"("installationId", "selected");

-- CreateIndex
CREATE UNIQUE INDEX "GithubRepository_installationId_githubRepoId_key" ON "GithubRepository"("installationId", "githubRepoId");

-- AddForeignKey
ALTER TABLE "Pipeline" ADD CONSTRAINT "Pipeline_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PipelineStageLog" ADD CONSTRAINT "PipelineStageLog_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HumanOverride" ADD CONSTRAINT "HumanOverride_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GithubRepository" ADD CONSTRAINT "GithubRepository_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "GithubInstallation"("installationId") ON DELETE CASCADE ON UPDATE CASCADE;
