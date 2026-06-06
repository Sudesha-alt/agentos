-- Codebase guided tour cache (Claude-generated or heuristic fallback)

CREATE TABLE IF NOT EXISTS "CodebaseTourCache" (
  "id" TEXT NOT NULL,
  "repoOwner" TEXT NOT NULL,
  "repoName" TEXT NOT NULL,
  "branchName" TEXT NOT NULL,
  "tourJson" JSONB NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CodebaseTourCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CodebaseTourCache_repoOwner_repoName_branchName_key"
  ON "CodebaseTourCache"("repoOwner", "repoName", "branchName");
