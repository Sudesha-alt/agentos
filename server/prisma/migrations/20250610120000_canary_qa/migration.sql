-- CreateEnum
CREATE TYPE "CanaryRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "CanaryRun" (
    "id" TEXT NOT NULL,
    "pipelineId" TEXT,
    "jiraKey" TEXT,
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "environment" TEXT NOT NULL DEFAULT 'staging',
    "scope" TEXT NOT NULL DEFAULT 'full',
    "targetUrl" TEXT NOT NULL,
    "status" "CanaryRunStatus" NOT NULL DEFAULT 'PENDING',
    "phase" TEXT,
    "understanding" JSONB,
    "hypotheses" JSONB,
    "summary" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "CanaryRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CanaryFinding" (
    "id" TEXT NOT NULL,
    "canaryRunId" TEXT NOT NULL,
    "hypothesisId" TEXT,
    "severity" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "reproductionSteps" TEXT,
    "evidence" JSONB,
    "affectedCode" TEXT,
    "suggestedFix" TEXT,
    "jiraKeyCreated" TEXT,
    "embeddedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CanaryFinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CanaryRun_pipelineId_idx" ON "CanaryRun"("pipelineId");

-- CreateIndex
CREATE INDEX "CanaryRun_status_environment_idx" ON "CanaryRun"("status", "environment");

-- CreateIndex
CREATE INDEX "CanaryRun_jiraKey_idx" ON "CanaryRun"("jiraKey");

-- CreateIndex
CREATE INDEX "CanaryFinding_canaryRunId_severity_idx" ON "CanaryFinding"("canaryRunId", "severity");

-- AddForeignKey
ALTER TABLE "CanaryRun" ADD CONSTRAINT "CanaryRun_pipelineId_fkey" FOREIGN KEY ("pipelineId") REFERENCES "Pipeline"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CanaryFinding" ADD CONSTRAINT "CanaryFinding_canaryRunId_fkey" FOREIGN KEY ("canaryRunId") REFERENCES "CanaryRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
