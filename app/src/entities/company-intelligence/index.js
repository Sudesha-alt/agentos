import { DATA_MODE, DATA_MODES } from "../../shared/config/app";
import { apiPath } from "../../shared/config/apiBase";
import { authHeaders } from "../../shared/lib/authHeaders";
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
  competitors: [],
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
    const data = await fetchJson(apiPath("/api/company-intelligence"), {
      headers: authHeaders(),
    });
    return data?.profile ?? EMPTY_COMPANY_PROFILE;
  },
  async save(profile) {
    const data = await fetchJson(apiPath("/api/company-intelligence"), {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
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
  async fetchFromWeb({ website, companyName, profile }) {
    const data = await fetchJson(apiPath("/api/company-intelligence/fetch-from-web"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        website,
        companyName,
        ...profile,
      }),
    });
    return data;
  },
  async fetchCompetitors({ website, companyName, productSummary, profile }) {
    const data = await fetchJson(apiPath("/api/company-intelligence/fetch-competitors"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({
        website,
        companyName,
        productSummary,
        ...profile,
      }),
    });
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
  async fetchFromWeb({ website, companyName }) {
    const host = String(website || "")
      .replace(/^https?:\/\//i, "")
      .split("/")[0];
    const brand = companyName?.trim() || host.split(".")[0] || "Company";
    const title = brand.charAt(0).toUpperCase() + brand.slice(1);

    return {
      suggested: {
        companyName: title,
        website: website?.startsWith("http") ? website : `https://${host}`,
        productSummary: `${title} delivers a B2B SaaS platform for workflow automation and team collaboration.`,
        icp: "Mid-market and enterprise teams adopting AI-assisted product delivery.",
        revenueModel: "Subscription SaaS with tiered workspace pricing and usage-based API overage.",
        pricingSummary: "Starter, Growth, and Enterprise tiers — exact pricing inferred from public marketing pages.",
        strategicGoals: [
          "Expand enterprise adoption",
          "Ship AI-native workflow features",
          "Reduce time-to-value for new customers",
        ],
        nonGoals: [],
      },
      sources: [
        { url: website, method: "jina_reader", chars: 4200, ok: true },
        { url: `${website}/about`, method: "html_meta", chars: 1800, ok: true },
      ],
      technologies: ["Jina Reader", "Open Graph / JSON-LD meta", "Multi-page crawl (/about, /pricing)"],
      confidenceNotes:
        "Mock mode — sample enrichment. Connect the API server for live Jina Reader + LLM structuring.",
      costUsd: 0,
      model: "mock",
    };
  },
  async fetchCompetitors({ website, companyName, productSummary }) {
    const host = String(website || "")
      .replace(/^https?:\/\//i, "")
      .split("/")[0];
    const brand = companyName?.trim() || host.split(".")[0] || "Company";
    const title = brand.charAt(0).toUpperCase() + brand.slice(1);

    const competitors = [
      {
        name: "RivalFlow",
        website: "https://rivalflow.example",
        description: "Workflow automation for mid-market ops teams.",
        source: "mock",
      },
      {
        name: "OpsPilot",
        website: "https://opspilot.example",
        description: `${title} competitor focused on AI-assisted task routing.`,
        source: "mock",
      },
      {
        name: "TeamForge",
        website: "https://teamforge.example",
        description: "Enterprise collaboration with embedded PM agents.",
        source: "mock",
      },
    ];

    return {
      competitors,
      suggested: { competitors },
      sources: [{ url: website, method: "mock", chars: 0, ok: true }],
      costUsd: 0,
      model: "mock",
      confidenceNotes: productSummary
        ? `Mock competitors inferred from product: ${productSummary.slice(0, 80)}…`
        : "Mock mode — connect API server for live competitor discovery.",
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

export async function fetchCompanyFromWeb({ website, companyName, profile }) {
  return companyIntelligenceAdapter.fetchFromWeb({ website, companyName, profile });
}

export async function fetchCompetitorsFromWeb({ website, companyName, productSummary, profile }) {
  return companyIntelligenceAdapter.fetchCompetitors({
    website,
    companyName,
    productSummary,
    profile,
  });
}
