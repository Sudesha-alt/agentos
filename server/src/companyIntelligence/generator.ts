import { getOpenAIPremiumModel } from "../llm/openaiClient";
import { chatCompletionText, parseDiscoveryJson } from "../llm/openaiCompletion";
import { retriever } from "../rag/retriever";
import { logger } from "../utils/logger";
import { gatherCodebaseBusinessSignals } from "./codebaseContext";
import type { CompanyProfile } from "./types";

const GENERATE_SYSTEM = `You are a senior product strategist inferring a company's business context from its indexed codebase.

PRIMARY evidence: codebase intelligence — architecture, modules, domain folders, billing/pricing/auth patterns, README/marketing files, and file summaries reveal what the product does, who it serves, and how it likely makes money.

SECONDARY evidence: optional customer-provided fields and vector DB ticket/PRD learnings.

Rules:
- Infer business context from the codebase first — what product is being built, core user workflows, monetization signals (billing, subscriptions, usage meters), and strategic focus implied by module structure.
- Do not invent features or markets absent from codebase evidence; mark uncertainty where inference is weak.
- Customer form fields override inference when they explicitly conflict.
- Write editable third-person prose a PM agent can use to validate new ideas.
- Include likely revenue model hypothesis when billing/commerce modules exist.`;

function buildRetrievalQuery(
  profile: Pick<
    CompanyProfile,
    | "companyName"
    | "productSummary"
    | "icp"
    | "revenueModel"
    | "pricingSummary"
    | "strategicGoals"
  >
): string {
  return [
    profile.companyName,
    profile.productSummary,
    profile.icp,
    profile.revenueModel,
    profile.pricingSummary,
    ...(profile.strategicGoals ?? []),
    "product business revenue customers",
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 1200);
}

function formatVectorContext(
  hits: Awaited<ReturnType<typeof retriever.retrieveForCompanyProfile>>
): string {
  if (!hits.length) {
    return "No supplemental ticket/PRD entries in vector database.";
  }

  return hits
    .map((hit) => {
      const snippet = hit.content.replace(/\s+/g, " ").slice(0, 350);
      const source = hit.source === "keyword_fallback" ? "keyword" : "semantic";
      return `- [${hit.contentType}] ${hit.jiraKey} (${source}, sim=${hit.similarity.toFixed(2)}): ${snippet}`;
    })
    .join("\n");
}

export async function generateBusinessContext(
  profile: Pick<
    CompanyProfile,
    | "companyName"
    | "website"
    | "productSummary"
    | "icp"
    | "revenueModel"
    | "pricingSummary"
    | "strategicGoals"
    | "nonGoals"
  >
): Promise<{
  businessContext: string;
  usage: { costUsd: number };
  model: string;
  vectorHitsUsed: number;
  codebaseFilesIndexed: number;
  repoLabel: string | null;
}> {
  const goals = profile.strategicGoals.length
    ? profile.strategicGoals.map((g) => `- ${g}`).join("\n")
    : "None specified";
  const nonGoals = profile.nonGoals.length
    ? profile.nonGoals.map((g) => `- ${g}`).join("\n")
    : "None specified";

  const codebase = await gatherCodebaseBusinessSignals();

  let vectorBlock = "Vector retrieval skipped.";
  let vectorHitsUsed = 0;
  const query = buildRetrievalQuery(profile);

  if (query.trim()) {
    try {
      const hits = await retriever.retrieveForCompanyProfile(query);
      vectorHitsUsed = hits.length;
      vectorBlock = formatVectorContext(hits);
      logger.info({ vectorHitsUsed }, "company context: vector supplement retrieved");
    } catch (err) {
      logger.warn({ err }, "company context: vector supplement failed");
      vectorBlock = "Vector database unavailable.";
    }
  }

  const premiumModel = getOpenAIPremiumModel();

  const user = `Infer business context primarily from the codebase intelligence below. The customer will edit the result.

CODEBASE INTELLIGENCE (primary — derive product, users, revenue model, and strategy from this):
${codebase.block}

OPTIONAL CUSTOMER OVERRIDES (use when provided; do not let empty fields block codebase inference):
Company name: ${profile.companyName || "Infer from repo if possible"}
Website: ${profile.website || "Not provided"}
Stated product summary: ${profile.productSummary || "Infer from codebase"}
Stated ICP: ${profile.icp || "Infer from codebase domains"}
Stated revenue model: ${profile.revenueModel || "Infer from billing/commerce modules if present"}
Stated pricing: ${profile.pricingSummary || "Infer if signals exist"}
Stated strategic goals:
${goals}
Stated non-goals:
${nonGoals}

SUPPLEMENTAL VECTOR DB (tickets, PRDs, org learnings):
${vectorBlock}

Output JSON:
{
  "businessContext": "3-5 paragraphs: what the company/product does (from codebase), who it serves, how it likely makes money (cite modules/patterns), strategic priorities implied by the repo, and explicit boundaries. Note inference confidence where thin.",
  "inferredProductSummary": "one sentence from codebase",
  "inferredRevenueModel": "one sentence from codebase or 'unclear'",
  "inferredIcp": "one sentence from codebase or 'unclear'"
}`;

  const { text, usage, model } = await chatCompletionText({
    system: GENERATE_SYSTEM,
    user,
    maxTokens: 4500,
    jsonMode: true,
    model: premiumModel,
  });

  const parsed = parseDiscoveryJson<{
    businessContext: string;
    inferredProductSummary?: string;
    inferredRevenueModel?: string;
    inferredIcp?: string;
  }>(text, "company_business_context");

  let businessContext = parsed.businessContext?.trim() ?? "";
  if (parsed.inferredProductSummary && !profile.productSummary?.trim()) {
    businessContext += `\n\nInferred product: ${parsed.inferredProductSummary}`;
  }
  if (parsed.inferredRevenueModel && !profile.revenueModel?.trim()) {
    businessContext += `\nInferred revenue model: ${parsed.inferredRevenueModel}`;
  }
  if (parsed.inferredIcp && !profile.icp?.trim()) {
    businessContext += `\nInferred ICP: ${parsed.inferredIcp}`;
  }

  return {
    businessContext,
    usage: { costUsd: usage.costUsd },
    model,
    vectorHitsUsed,
    codebaseFilesIndexed: codebase.indexedFiles,
    repoLabel: codebase.repoLabel,
  };
}
