import { getOpenAIPremiumModel } from "../llm/openaiClient";
import { chatCompletionText, parseDiscoveryJson } from "../llm/openaiCompletion";
import type { CompanyProfileInput } from "./types";
import type { WebFetchBundle } from "./webFetcher";

export type WebEnrichedCompanyFields = {
  companyName: string;
  website: string;
  productSummary: string;
  icp: string;
  revenueModel: string;
  pricingSummary: string;
  strategicGoals: string[];
  nonGoals: string[];
  confidenceNotes: string;
};

const STRUCTURE_SYSTEM = `You extract structured company profile fields from public website content.

Rules:
- Only state facts supported by the scraped text; mark uncertainty in confidenceNotes.
- If pricing is not explicit, summarize what is visible or write "Not found on public site".
- strategicGoals: infer 2-4 plausible priorities from positioning copy, not invented OKRs.
- nonGoals: only if the site implies exclusions (e.g. "not for consumers"); else empty array.
- Keep fields concise and editable — a human will review and correct mistakes.`;

export async function enrichCompanyFieldsFromWeb(
  bundle: WebFetchBundle,
  hints: { companyName?: string }
): Promise<{
  fields: WebEnrichedCompanyFields;
  usage: { costUsd: number };
  model: string;
}> {
  const premiumModel = getOpenAIPremiumModel();

  const user = `Website: ${bundle.website}
${hints.companyName ? `Hint company name: ${hints.companyName}` : ""}

Scraped public content (Jina Reader markdown + HTML meta + supplemental pages):
${bundle.combinedText}

Return JSON:
{
  "companyName": "official company or product brand name",
  "website": "${bundle.website}",
  "productSummary": "what they build in 2-3 sentences",
  "icp": "ideal customer profile",
  "revenueModel": "how they likely make money",
  "pricingSummary": "visible pricing tiers or packaging if any",
  "strategicGoals": ["goal 1", "goal 2"],
  "nonGoals": [],
  "confidenceNotes": "what was clear vs inferred vs missing"
}`;

  const { text, usage, model } = await chatCompletionText({
    system: STRUCTURE_SYSTEM,
    user,
    maxTokens: 2200,
    jsonMode: true,
    model: premiumModel,
  });

  const parsed = parseDiscoveryJson<WebEnrichedCompanyFields>(text, "company_web_enrich");

  return {
    fields: {
      companyName: parsed.companyName?.trim() || hints.companyName?.trim() || "",
      website: bundle.website,
      productSummary: parsed.productSummary?.trim() ?? "",
      icp: parsed.icp?.trim() ?? "",
      revenueModel: parsed.revenueModel?.trim() ?? "",
      pricingSummary: parsed.pricingSummary?.trim() ?? "",
      strategicGoals: Array.isArray(parsed.strategicGoals)
        ? parsed.strategicGoals.map((g) => String(g).trim()).filter(Boolean)
        : [],
      nonGoals: Array.isArray(parsed.nonGoals)
        ? parsed.nonGoals.map((g) => String(g).trim()).filter(Boolean)
        : [],
      confidenceNotes: parsed.confidenceNotes?.trim() ?? "",
    },
    usage: { costUsd: usage.costUsd },
    model,
  };
}

export function mergeWebFieldsIntoProfile(
  current: CompanyProfileInput,
  fields: WebEnrichedCompanyFields
): CompanyProfileInput {
  return {
    ...current,
    companyName: fields.companyName || current.companyName,
    website: fields.website || current.website,
    productSummary: fields.productSummary || current.productSummary,
    icp: fields.icp || current.icp,
    revenueModel: fields.revenueModel || current.revenueModel,
    pricingSummary: fields.pricingSummary || current.pricingSummary,
    strategicGoals: fields.strategicGoals.length
      ? fields.strategicGoals
      : current.strategicGoals,
    nonGoals: fields.nonGoals.length ? fields.nonGoals : current.nonGoals,
  };
}

/** Heuristic extraction when OpenAI is unavailable or LLM enrichment fails. */
export function enrichCompanyFieldsFromWebFallback(
  bundle: WebFetchBundle,
  hints: { companyName?: string }
): WebEnrichedCompanyFields {
  const text = bundle.combinedText;

  const titleMatch = text.match(/Title:\s*(.+)/i);
  const ogDescMatch = text.match(/og:description:\s*(.+)/i);
  const descMatch = text.match(/description:\s*(.+)/i);
  const bodyMatch = text.match(/Body excerpt:\s*(.+)/i);

  const productSummary =
    ogDescMatch?.[1]?.trim() ||
    descMatch?.[1]?.trim() ||
    bodyMatch?.[1]?.trim().slice(0, 400) ||
    "";

  const host = new URL(bundle.website).hostname.replace(/^www\./, "");
  const brandFromHost = host.split(".")[0] ?? "Company";
  const companyName =
    hints.companyName?.trim() ||
    titleMatch?.[1]?.trim().replace(/\s*[|\-–—].*$/, "").trim() ||
    brandFromHost.charAt(0).toUpperCase() + brandFromHost.slice(1);

  return {
    companyName,
    website: bundle.website,
    productSummary,
    icp: "",
    revenueModel: "",
    pricingSummary: "",
    strategicGoals: [],
    nonGoals: [],
    confidenceNotes:
      "Extracted from public page metadata only (LLM enrichment unavailable). Review and edit fields before continuing.",
  };
}
