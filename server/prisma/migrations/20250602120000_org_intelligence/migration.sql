-- CreateTable
CREATE TABLE "OrgIntelligenceRecord" (
    "id" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "jiraKey" TEXT NOT NULL,
    "pipelineId" TEXT,
    "component" TEXT,
    "signal" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrgIntelligenceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrgIntelligenceRecord_jiraKey_createdAt_idx" ON "OrgIntelligenceRecord"("jiraKey", "createdAt");

-- CreateIndex
CREATE INDEX "OrgIntelligenceRecord_sourceType_createdAt_idx" ON "OrgIntelligenceRecord"("sourceType", "createdAt");

-- CreateIndex
CREATE INDEX "OrgIntelligenceRecord_component_idx" ON "OrgIntelligenceRecord"("component");
