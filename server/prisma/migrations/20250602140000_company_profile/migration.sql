-- CreateTable
CREATE TABLE "CompanyProfile" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "companyName" TEXT NOT NULL DEFAULT '',
    "website" TEXT NOT NULL DEFAULT '',
    "productSummary" TEXT NOT NULL DEFAULT '',
    "icp" TEXT NOT NULL DEFAULT '',
    "revenueModel" TEXT NOT NULL DEFAULT '',
    "pricingSummary" TEXT NOT NULL DEFAULT '',
    "businessContext" TEXT NOT NULL DEFAULT '',
    "strategicGoals" JSONB NOT NULL DEFAULT '[]',
    "nonGoals" JSONB NOT NULL DEFAULT '[]',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("id")
);
