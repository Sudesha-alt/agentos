-- Allow multiple organizations per email domain (teams can fork their own workspace).
DROP INDEX IF EXISTS "Organization_domain_key";
CREATE INDEX "Organization_domain_idx" ON "Organization"("domain");

-- Per-organization Git integration credentials (mirrors OrganizationJiraConfig).
CREATE TABLE "OrganizationGitConfig" (
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'github',
    "workspace" TEXT NOT NULL DEFAULT '',
    "repoSlug" TEXT NOT NULL DEFAULT '',
    "username" TEXT,
    "token" TEXT NOT NULL DEFAULT '',
    "webhookSecret" TEXT NOT NULL DEFAULT '',
    "defaultBranch" TEXT NOT NULL DEFAULT 'main',
    "installationId" TEXT,
    "authMethod" TEXT NOT NULL DEFAULT 'pat',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationGitConfig_pkey" PRIMARY KEY ("organizationId")
);

ALTER TABLE "OrganizationGitConfig" ADD CONSTRAINT "OrganizationGitConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
