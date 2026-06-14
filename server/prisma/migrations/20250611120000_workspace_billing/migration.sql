-- CreateTable
CREATE TABLE "WorkspaceBilling" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "planId" TEXT NOT NULL DEFAULT 'pilot',
    "runsUsed" INTEGER NOT NULL DEFAULT 0,
    "runsCap" INTEGER NOT NULL DEFAULT 20,
    "pilotEndsAt" TIMESTAMP(3),
    "billingCycle" TEXT NOT NULL DEFAULT 'monthly',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceBilling_pkey" PRIMARY KEY ("id")
);
