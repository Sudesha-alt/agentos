-- Staged company roadmap: sectors, tickets, dependency routing.

DO $$ BEGIN
  CREATE TYPE "RoadmapItemStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "RoadmapRouteType" AS ENUM ('USER_INPUT', 'AGENT', 'APPROVAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Roadmap" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Company roadmap',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Roadmap_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RoadmapStage" (
    "id" TEXT NOT NULL,
    "roadmapId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    CONSTRAINT "RoadmapStage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RoadmapItem" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "roadmapId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "routeType" "RoadmapRouteType" NOT NULL DEFAULT 'USER_INPUT',
    "status" "RoadmapItemStatus" NOT NULL DEFAULT 'PENDING',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "dependsOnSlugs" JSONB NOT NULL DEFAULT '[]',
    "jiraKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RoadmapItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Roadmap_organizationId_key" ON "Roadmap"("organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "RoadmapStage_roadmapId_key_key" ON "RoadmapStage"("roadmapId", "key");
CREATE INDEX IF NOT EXISTS "RoadmapStage_roadmapId_sortOrder_idx" ON "RoadmapStage"("roadmapId", "sortOrder");
CREATE UNIQUE INDEX IF NOT EXISTS "RoadmapItem_roadmapId_slug_key" ON "RoadmapItem"("roadmapId", "slug");
CREATE INDEX IF NOT EXISTS "RoadmapItem_organizationId_idx" ON "RoadmapItem"("organizationId");
CREATE INDEX IF NOT EXISTS "RoadmapItem_roadmapId_stageId_idx" ON "RoadmapItem"("roadmapId", "stageId");

DO $$ BEGIN
  ALTER TABLE "Roadmap" ADD CONSTRAINT "Roadmap_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "RoadmapStage" ADD CONSTRAINT "RoadmapStage_roadmapId_fkey"
    FOREIGN KEY ("roadmapId") REFERENCES "Roadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "RoadmapItem" ADD CONSTRAINT "RoadmapItem_roadmapId_fkey"
    FOREIGN KEY ("roadmapId") REFERENCES "Roadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "RoadmapItem" ADD CONSTRAINT "RoadmapItem_stageId_fkey"
    FOREIGN KEY ("stageId") REFERENCES "RoadmapStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
