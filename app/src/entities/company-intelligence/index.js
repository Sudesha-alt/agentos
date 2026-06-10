import { DATA_MODE, DATA_MODES } from "../../shared/config/app";
import { apiPath } from "../../shared/config/apiBase";
import { fetchJson } from "../../shared/lib/fetchJson";
import { useResource } from "../../shared/lib/useResource";

const STORAGE_KEY = "agentos.companyProfile";

export const EMPTY_COMPANY_PROFILE = {
  id: "default",
  companyName: "",
  website: "",
  productSummary: "",
  icp: "",
  revenueModel: "",
  pricingSummary: "",
  businessContext: "",
  strategicGoals: [],
  nonGoals: [],
  updatedAt: null,
  updatedBy: null,
};

function readLocalProfile() {
  if (typeof window === "undefined") return EMPTY_COMPANY_PROFILE;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return EMPTY_COMPANY_PROFILE;
  try {
    return { ...EMPTY_COMPANY_PROFILE, ...JSON.parse(raw) };
  } catch {
    return EMPTY_COMPANY_PROFILE;
  }
}

function writeLocalProfile(profile) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  }
}

const restAdapter = {
  async get() {
    const data = await fetchJson(apiPath("/api/company-intelligence"));
    return data?.profile ?? EMPTY_COMPANY_PROFILE;
  },
  async save(profile) {
    const data = await fetchJson(apiPath("/api/company-intelligence"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    writeLocalProfile(data.profile);
    return data.profile;
  },
  async generateContext(profile) {
    const data = await fetchJson(apiPath("/api/company-intelligence/generate-context"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profile),
    });
    writeLocalProfile(data.profile);
    return data;
  },
};

const mockAdapter = {
  async get() {
    return readLocalProfile();
  },
  async save(profile) {
    const saved = {
      ...profile,
      updatedAt: new Date().toISOString(),
    };
    writeLocalProfile(saved);
    return saved;
  },
  async generateContext(profile) {
    const context = [
      profile.companyName
        ? `${profile.companyName} builds ${profile.productSummary || "software products"}.`
        : "",
      profile.icp ? `They serve ${profile.icp}.` : "",
      profile.revenueModel ? `Revenue: ${profile.revenueModel}.` : "",
      profile.strategicGoals?.length
        ? `Priorities: ${profile.strategicGoals.join("; ")}.`
        : "",
    ]
      .filter(Boolean)
      .join(" ");

    const saved = {
      ...profile,
      businessContext: context || "Configure company details to generate business context.",
      updatedAt: new Date().toISOString(),
    };
    writeLocalProfile(saved);
    return {
      profile: saved,
      costUsd: 0,
      model: "mock",
      vectorHitsUsed: 0,
      codebaseFilesIndexed: 0,
      repoLabel: null,
    };
  },
};

export const companyIntelligenceAdapter =
  DATA_MODE === DATA_MODES.REST ? restAdapter : mockAdapter;

export function useCompanyProfile() {
  return useResource(() => companyIntelligenceAdapter.get(), [DATA_MODE]);
}

export async function saveCompanyProfile(profile) {
  return companyIntelligenceAdapter.save(profile);
}

export async function generateCompanyContext(profile) {
  return companyIntelligenceAdapter.generateContext(profile);
}
