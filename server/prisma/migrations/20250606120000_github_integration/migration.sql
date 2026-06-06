-- GitHub App installations + index progress fields

ALTER TABLE "CodebaseIndexRun" ADD COLUMN IF NOT EXISTS "filesTotal" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CodebaseIndexRun" ADD COLUMN IF NOT EXISTS "filesProcessed" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "CodebaseIndexRun_repoOwner_repoName_status_idx"
  ON "CodebaseIndexRun"("repoOwner", "repoName", "status");
CREATE INDEX IF NOT EXISTS "CodebaseIndexRun_startedAt_idx"
  ON "CodebaseIndexRun"("startedAt");

CREATE TABLE IF NOT EXISTS "GithubInstallation" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "GithubInstallation_installationId_key"
  ON "GithubInstallation"("installationId");
CREATE INDEX IF NOT EXISTS "GithubInstallation_accountLogin_idx"
  ON "GithubInstallation"("accountLogin");

CREATE TABLE IF NOT EXISTS "GithubRepository" (
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

CREATE UNIQUE INDEX IF NOT EXISTS "GithubRepository_installationId_githubRepoId_key"
  ON "GithubRepository"("installationId", "githubRepoId");
CREATE INDEX IF NOT EXISTS "GithubRepository_fullName_idx"
  ON "GithubRepository"("fullName");
CREATE INDEX IF NOT EXISTS "GithubRepository_installationId_selected_idx"
  ON "GithubRepository"("installationId", "selected");

ALTER TABLE "GithubRepository"
  DROP CONSTRAINT IF EXISTS "GithubRepository_installationId_fkey";
ALTER TABLE "GithubRepository"
  ADD CONSTRAINT "GithubRepository_installationId_fkey"
  FOREIGN KEY ("installationId") REFERENCES "GithubInstallation"("installationId")
  ON DELETE CASCADE ON UPDATE CASCADE;
