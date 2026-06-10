import { prisma } from "../db/client";
import type { CompanyProfile, CompanyProfileInput } from "./types";

const DEFAULT_ID = "default";

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v).trim()).filter(Boolean);
}

function rowToProfile(row: {
  id: string;
  companyName: string;
  website: string;
  productSummary: string;
  icp: string;
  revenueModel: string;
  pricingSummary: string;
  businessContext: string;
  strategicGoals: unknown;
  nonGoals: unknown;
  updatedAt: Date;
  updatedBy: string | null;
}): CompanyProfile {
  return {
    id: row.id,
    companyName: row.companyName,
    website: row.website,
    productSummary: row.productSummary,
    icp: row.icp,
    revenueModel: row.revenueModel,
    pricingSummary: row.pricingSummary,
    businessContext: row.businessContext,
    strategicGoals: parseStringArray(row.strategicGoals),
    nonGoals: parseStringArray(row.nonGoals),
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
  };
}

export const EMPTY_PROFILE: CompanyProfile = {
  id: DEFAULT_ID,
  companyName: "",
  website: "",
  productSummary: "",
  icp: "",
  revenueModel: "",
  pricingSummary: "",
  businessContext: "",
  strategicGoals: [],
  nonGoals: [],
  updatedAt: new Date(0).toISOString(),
  updatedBy: null,
};

export async function getCompanyProfile(): Promise<CompanyProfile> {
  const row = await prisma.companyProfile.findUnique({ where: { id: DEFAULT_ID } });
  if (!row) return { ...EMPTY_PROFILE };
  return rowToProfile(row);
}

export async function saveCompanyProfile(
  input: CompanyProfileInput
): Promise<CompanyProfile> {
  const data = {
    companyName: input.companyName !== undefined ? String(input.companyName) : undefined,
    website: input.website !== undefined ? String(input.website) : undefined,
    productSummary:
      input.productSummary !== undefined ? String(input.productSummary) : undefined,
    icp: input.icp !== undefined ? String(input.icp) : undefined,
    revenueModel: input.revenueModel !== undefined ? String(input.revenueModel) : undefined,
    pricingSummary:
      input.pricingSummary !== undefined ? String(input.pricingSummary) : undefined,
    businessContext:
      input.businessContext !== undefined ? String(input.businessContext) : undefined,
    strategicGoals:
      input.strategicGoals !== undefined
        ? parseStringArray(input.strategicGoals)
        : undefined,
    nonGoals:
      input.nonGoals !== undefined ? parseStringArray(input.nonGoals) : undefined,
    updatedBy: input.updatedBy !== undefined ? input.updatedBy : undefined,
  };

  const row = await prisma.companyProfile.upsert({
    where: { id: DEFAULT_ID },
    create: {
      id: DEFAULT_ID,
      companyName: data.companyName ?? "",
      website: data.website ?? "",
      productSummary: data.productSummary ?? "",
      icp: data.icp ?? "",
      revenueModel: data.revenueModel ?? "",
      pricingSummary: data.pricingSummary ?? "",
      businessContext: data.businessContext ?? "",
      strategicGoals: data.strategicGoals ?? [],
      nonGoals: data.nonGoals ?? [],
      updatedBy: data.updatedBy ?? null,
    },
    update: {
      ...(data.companyName !== undefined ? { companyName: data.companyName } : {}),
      ...(data.website !== undefined ? { website: data.website } : {}),
      ...(data.productSummary !== undefined ? { productSummary: data.productSummary } : {}),
      ...(data.icp !== undefined ? { icp: data.icp } : {}),
      ...(data.revenueModel !== undefined ? { revenueModel: data.revenueModel } : {}),
      ...(data.pricingSummary !== undefined ? { pricingSummary: data.pricingSummary } : {}),
      ...(data.businessContext !== undefined ? { businessContext: data.businessContext } : {}),
      ...(data.strategicGoals !== undefined ? { strategicGoals: data.strategicGoals } : {}),
      ...(data.nonGoals !== undefined ? { nonGoals: data.nonGoals } : {}),
      ...(data.updatedBy !== undefined ? { updatedBy: data.updatedBy } : {}),
    },
  });

  return rowToProfile(row);
}
