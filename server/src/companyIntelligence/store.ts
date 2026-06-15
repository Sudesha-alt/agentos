import { prisma } from "../db/client";
import type { Prisma } from "../generated/prisma/client";
import type { CompanyProfile, CompanyProfileInput, CompetitorEntry } from "./types";

const DEFAULT_ID = "default";

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v).trim()).filter(Boolean);
}

function parseCompetitors(value: unknown): CompetitorEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((c): CompetitorEntry[] => {
    if (!c || typeof c !== "object") return [];
    const row = c as Record<string, unknown>;
    const name = String(row.name ?? "").trim();
    if (!name) return [];
    const description = String(row.description ?? "").trim();
    const source = String(row.source ?? "").trim();
    return [
      {
        name,
        website: String(row.website ?? "").trim(),
        ...(description ? { description } : {}),
        ...(source ? { source } : {}),
      },
    ];
  });
}

function competitorsToJson(competitors: CompetitorEntry[]): Prisma.InputJsonValue {
  return competitors as unknown as Prisma.InputJsonValue;
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
  competitors: unknown;
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
    competitors: parseCompetitors(row.competitors),
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
  competitors: [],
  updatedAt: new Date(0).toISOString(),
  updatedBy: null,
};

export async function getCompanyProfile(
  organizationId?: string
): Promise<CompanyProfile> {
  if (organizationId) {
    const row = await prisma.companyProfile.findUnique({
      where: { organizationId },
    });
    if (row) return rowToProfile(row);
  }

  const legacy = await prisma.companyProfile.findFirst({
    where: { id: "default" },
  });
  if (legacy) return rowToProfile(legacy);

  return { ...EMPTY_PROFILE };
}

export async function saveCompanyProfile(
  input: CompanyProfileInput,
  organizationId?: string
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
    competitors:
      input.competitors !== undefined ? parseCompetitors(input.competitors) : undefined,
    updatedBy: input.updatedBy !== undefined ? input.updatedBy : undefined,
  };

  const row = organizationId
    ? await prisma.companyProfile.upsert({
        where: { organizationId },
        create: {
          organizationId,
          companyName: data.companyName ?? "",
          website: data.website ?? "",
          productSummary: data.productSummary ?? "",
          icp: data.icp ?? "",
          revenueModel: data.revenueModel ?? "",
          pricingSummary: data.pricingSummary ?? "",
          businessContext: data.businessContext ?? "",
          strategicGoals: data.strategicGoals ?? [],
          nonGoals: data.nonGoals ?? [],
          competitors: competitorsToJson(data.competitors ?? []),
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
          ...(data.competitors !== undefined
            ? { competitors: competitorsToJson(data.competitors) }
            : {}),
          ...(data.updatedBy !== undefined ? { updatedBy: data.updatedBy } : {}),
        },
      })
    : await prisma.companyProfile.upsert({
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
          competitors: competitorsToJson(data.competitors ?? []),
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
          ...(data.competitors !== undefined
            ? { competitors: competitorsToJson(data.competitors) }
            : {}),
          ...(data.updatedBy !== undefined ? { updatedBy: data.updatedBy } : {}),
        },
      });

  return rowToProfile(row);
}
