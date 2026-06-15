import { embedder } from "../rag/embedder";
import { orgIntelligence } from "../orgIntelligence";
import { logger } from "../utils/logger";
import { discoverCompetitorsFromWeb } from "./competitorFetcher";
import { generateBusinessContext } from "./generator";
import { EMPTY_PROFILE, getCompanyProfile, saveCompanyProfile } from "./store";
import type { CompanyIdeaValidation, CompanyProfile, CompanyProfileInput } from "./types";
import { enrichCompanyFieldsFromWeb, mergeWebFieldsIntoProfile } from "./webEnricher";
import { fetchCompanyWebContext } from "./webFetcher";

export type { CompanyProfile, CompanyProfileInput, CompanyIdeaValidation, BusinessFit } from "./types";
export { EMPTY_PROFILE } from "./store";

export function toPromptBlock(profile: CompanyProfile): string {
  if (!profile.companyName && !profile.businessContext && !profile.productSummary) {
    return "COMPANY CONTEXT: Not configured — ask the stakeholder about business reason and revenue impact.";
  }

  const goals = profile.strategicGoals.length
    ? profile.strategicGoals.join("; ")
    : "none specified";
  const nonGoals = profile.nonGoals.length
    ? profile.nonGoals.join("; ")
    : "none specified";
  const competitors = profile.competitors?.length
    ? profile.competitors
        .map((c) => `${c.name}${c.website ? ` (${c.website})` : ""}${c.description ? `: ${c.description}` : ""}`)
        .join("; ")
    : "none listed";

  return [
    `COMPANY: ${profile.companyName || "Unknown"}`,
    profile.businessContext
      ? `BUSINESS CONTEXT:\n${profile.businessContext}`
      : `PRODUCT: ${profile.productSummary}`,
    profile.icp ? `ICP: ${profile.icp}` : "",
    profile.revenueModel ? `REVENUE MODEL: ${profile.revenueModel}` : "",
    profile.pricingSummary ? `PRICING: ${profile.pricingSummary}` : "",
    `STRATEGIC GOALS: ${goals}`,
    `COMPANY NON-GOALS: ${nonGoals}`,
    `COMPETITORS: ${competitors}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function mapBusinessFitToRevenueRisk(fit: string | undefined): string {
  switch (fit) {
    case "strong":
      return "high";
    case "moderate":
      return "medium";
    case "weak":
      return "low";
    case "misaligned":
      return "high";
    default:
      return "none";
  }
}

export const companyIntelligence = {
  async getProfile(organizationId?: string): Promise<CompanyProfile> {
    return getCompanyProfile(organizationId);
  },

  async saveProfile(
    input: CompanyProfileInput,
    organizationId?: string
  ): Promise<CompanyProfile> {
    const profile = await saveCompanyProfile(input, organizationId);
    await this.syncEmbeddings(profile);
    return profile;
  },

  async generateContext(
    input: CompanyProfileInput
  ): Promise<{
    profile: CompanyProfile;
    costUsd: number;
    model: string;
    vectorHitsUsed: number;
    codebaseFilesIndexed: number;
    repoLabel: string | null;
  }> {
    const current = await getCompanyProfile();
    const merged: CompanyProfile = {
      ...current,
      ...input,
      strategicGoals: input.strategicGoals ?? current.strategicGoals,
      nonGoals: input.nonGoals ?? current.nonGoals,
    };

    const {
      businessContext,
      usage,
      model,
      vectorHitsUsed,
      codebaseFilesIndexed,
      repoLabel,
    } = await generateBusinessContext(merged);
    const profile = await saveCompanyProfile({
      ...input,
      businessContext,
    });
    await this.syncEmbeddings(profile);

    try {
      await orgIntelligence.capture({
        sourceType: "COMPANY_PROFILE",
        jiraKey: "COMPANY",
        signal: `Company profile updated: ${profile.companyName || "unnamed"}`,
        metadata: {
          revenueModel: profile.revenueModel,
          goalCount: profile.strategicGoals.length,
          model,
          vectorHitsUsed,
          codebaseFilesIndexed,
          repoLabel,
        },
      });
    } catch (err) {
      logger.warn({ err }, "company profile org intel capture failed");
    }

    return {
      profile,
      costUsd: usage.costUsd,
      model,
      vectorHitsUsed,
      codebaseFilesIndexed,
      repoLabel,
    };
  },

  async fetchFromWeb(input: {
    website: string;
    companyName?: string;
    mergeWithProfile?: CompanyProfileInput;
  }): Promise<{
    suggested: CompanyProfileInput;
    sources: Awaited<ReturnType<typeof fetchCompanyWebContext>>["sources"];
    technologies: string[];
    confidenceNotes: string;
    costUsd: number;
    model: string;
  }> {
    const bundle = await fetchCompanyWebContext(input.website);
    const current = input.mergeWithProfile ?? (await getCompanyProfile());
    const { fields, usage, model } = await enrichCompanyFieldsFromWeb(bundle, {
      companyName: input.companyName ?? current.companyName,
    });
    const suggested = mergeWebFieldsIntoProfile(current, fields);

    return {
      suggested,
      sources: bundle.sources,
      technologies: bundle.technologies,
      confidenceNotes: fields.confidenceNotes,
      costUsd: usage.costUsd,
      model,
    };
  },

  async fetchCompetitors(input: {
    website: string;
    companyName?: string;
    productSummary?: string;
    mergeWithProfile?: CompanyProfileInput;
  }): Promise<{
    suggested: CompanyProfileInput;
    competitors: import("./types").CompetitorEntry[];
    sources: Awaited<ReturnType<typeof discoverCompetitorsFromWeb>>["sources"];
    costUsd: number;
    model: string;
  }> {
    const { competitors, usage, model, sources } = await discoverCompetitorsFromWeb(input);
    const current = input.mergeWithProfile ?? (await getCompanyProfile());
    return {
      suggested: { ...current, competitors },
      competitors,
      sources,
      costUsd: usage.costUsd,
      model,
    };
  },

  toPromptBlock(profile?: CompanyProfile | null): string {
    return toPromptBlock(profile ?? EMPTY_PROFILE);
  },

  async syncEmbeddings(profile: CompanyProfile): Promise<void> {
    const text = toPromptBlock(profile);
    if (!text.includes("Not configured")) {
      try {
        await embedder.embedCompanyIntelligence(profile.id, text, {
          companyName: profile.companyName,
          updatedAt: profile.updatedAt,
        });
      } catch (err) {
        logger.warn({ err }, "company intelligence embed failed");
      }
    }
  },
};
