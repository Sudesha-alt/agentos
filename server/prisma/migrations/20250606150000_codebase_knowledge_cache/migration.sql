-- Codebase knowledge base cache (GPT-generated or heuristic fallback)

CREATE TABLE IF NOT EXISTS "CodebaseKnowledgeCache" (
  "id" TEXT NOT NULL,
  "repoOwner" TEXT NOT NULL,
  "repoName" TEXT NOT NULL,
  "branchName" TEXT NOT NULL,
  "knowledgeJson" JSONB NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CodebaseKnowledgeCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CodebaseKnowledgeCache_repoOwner_repoName_branchName_key"
  ON "CodebaseKnowledgeCache"("repoOwner", "repoName", "branchName");
