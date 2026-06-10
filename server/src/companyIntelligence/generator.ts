import { getOpenAIPremiumModel } from "../llm/openaiClient";
import { chatCompletionText, parseDiscoveryJson } from "../llm/openaiCompletion";
import { retriever } from "../rag/retriever";
import { logger } from "../utils/logger";
import type { CompanyProfile } from "./types";

const GENERATE_SYSTEM = `You are a senior business analyst synthesizing a company's strategic profile.
You receive: (1) structured fields the customer entered, and (2) retrieved knowledge from the organization's vector database (past tickets, PRDs, pipeline learnings, prior company notes).

Rules:
- Ground the business context in both the form fields AND vector evidence when available.
- Cite patterns from retrieved knowledge (e.g. recurring product themes, customer segments, revenue signals) without inventing facts not supported by the inputs.
- If vector evidence is sparse, say so briefly and rely on the form fields.
- Write editable prose the customer can refine. Third person.
- Be specific enough that a PM agent can judge whether a new idea fits the company.`;

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
  ]
    .filter(Boolean)
    .join(" ")
    .slice(0, 1200);
}

function formatVectorContext(
  hits: Awaited<ReturnType<typeof retriever.retrieveForCompanyProfile>>
): string {
  if (!hits.length) {
    return "No relevant entries found in the vector database yet. Synthesize from the structured company fields only.";
  }

  return hits
    .map((hit) => {
      const snippet = hit.content.replace(/\s+/g, " ").slice(0, 400);
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
}> {
  const goals = profile.strategicGoals.length
    ? profile.strategicGoals.map((g) => `- ${g}`).join("\n")
    : "None specified";
  const nonGoals = profile.nonGoals.length
    ? profile.nonGoals.map((g) => `- ${g}`).join("\n")
    : "None specified";

  let vectorBlock = "Vector retrieval skipped (no query terms).";
  let vectorHitsUsed = 0;
  const query = buildRetrievalQuery(profile);

  if (query.trim()) {
    try {
      const hits = await retriever.retrieveForCompanyProfile(query);
      vectorHitsUsed = hits.length;
      vectorBlock = formatVectorContext(hits);
      logger.info(
        { vectorHitsUsed, queryLength: query.length },
        "company context generation: vector retrieval complete"
      );
    } catch (err) {
      logger.warn({ err }, "company context generation: vector retrieval failed");
      vectorBlock =
        "Vector database unavailable — synthesize from structured company fields only.";
    }
  }

  const premiumModel = getOpenAIPremiumModel();

  const user = `Generate a business context document for this company. The customer will edit it.

STRUCTURED COMPANY FIELDS (customer-provided):
Company name: ${profile.companyName || "Unknown"}
Website: ${profile.website || "Not provided"}

What they build:
${profile.productSummary || "Not provided"}

Ideal customer (ICP):
${profile.icp || "Not provided"}

How they generate revenue:
${profile.revenueModel || "Not provided"}

Pricing / packaging:
${profile.pricingSummary || "Not provided"}

Strategic goals:
${goals}

Explicit non-goals:
${nonGoals}

RETRIEVED ORGANIZATIONAL KNOWLEDGE (vector database):
${vectorBlock}

Synthesize a business context that reflects what the company does, who it serves, how it makes money, strategic priorities, and explicit boundaries — grounded in the evidence above.

Output JSON:
{
  "businessContext": "3-5 paragraphs covering: what the company does, who it serves, how it makes money, current strategic priorities, and what is explicitly out of scope. Reference patterns from vector knowledge when present. Write in third person."
}`;

  const { text, usage, model } = await chatCompletionText({
    system: GENERATE_SYSTEM,
    user,
    maxTokens: 4000,
    jsonMode: true,
    model: premiumModel,
  });

  const parsed = parseDiscoveryJson<{ businessContext: string }>(
    text,
    "company_business_context"
  );

  return {
    businessContext: parsed.businessContext?.trim() ?? "",
    usage: { costUsd: usage.costUsd },
    model,
    vectorHitsUsed,
  };
}
