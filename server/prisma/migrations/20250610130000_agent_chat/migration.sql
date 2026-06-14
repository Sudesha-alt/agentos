-- CreateTable
CREATE TABLE "AgentChatThread" (
    "id" TEXT NOT NULL,
    "agentDomain" TEXT NOT NULL,
    "contextKey" TEXT NOT NULL DEFAULT '',
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentChatThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentChatMessage" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentChatMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentChatThread_agentDomain_idx" ON "AgentChatThread"("agentDomain");

-- CreateIndex
CREATE UNIQUE INDEX "AgentChatThread_agentDomain_contextKey_key" ON "AgentChatThread"("agentDomain", "contextKey");

-- CreateIndex
CREATE INDEX "AgentChatMessage_threadId_createdAt_idx" ON "AgentChatMessage"("threadId", "createdAt");

-- AddForeignKey
ALTER TABLE "AgentChatMessage" ADD CONSTRAINT "AgentChatMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "AgentChatThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;
