import { embedder } from "../rag/embedder";
import { orgIntelligence } from "../orgIntelligence";
import { logger } from "../utils/logger";
import { generateBusinessContext } from "./generator";
import { EMPTY_PROFILE, getCompanyProfile, saveCompanyProfile } from "./store";
import type { CompanyIdeaValidation, CompanyProfile, CompanyProfileInput } from "./types";

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
  async getProfile(): Promise<CompanyProfile> {
    return getCompanyProfile();
  },

  async saveProfile(input: CompanyProfileInput): Promise<CompanyProfile> {
    const profile = await saveCompanyProfile(input);
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
