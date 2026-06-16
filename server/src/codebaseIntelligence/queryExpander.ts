import { getBoostedPatternTags } from "../rag/retrievalLearning";
import { createChatCompletion, isOpenAIConfigured } from "../llm/openaiClient";
import { logger } from "../utils/logger";

export interface QueryExpansionInput {
  summary: string;
  description?: string;
  components?: string[];
}

const DOMAIN_KEYWORDS = [
  "auth",
  "billing",
  "payment",
  "pipeline",
  "jira",
  "api",
  "database",
  "checkout",
  "user",
  "admin",
  "qa",
  "test",
  "config",
  "migration",
  "webhook",
] as const;

function extractPathLikeTokens(text: string): string[] {
  const matches = text.match(/[\w./-]+\.(ts|tsx|js|jsx|py|go|sql|prisma|md)\b/gi) ?? [];
  return [...new Set(matches.map((m) => m.trim()))];
}

function extractDomainTerms(text: string): string[] {
  const lower = text.toLowerCase();
  return DOMAIN_KEYWORDS.filter((kw) => lower.includes(kw));
}

export function expandQueryRules(input: QueryExpansionInput): string[] {
  const parts = [
    input.summary,
    input.description ?? "",
    ...(input.components ?? []),
  ].filter(Boolean);

  const combined = parts.join(" ");
  const phrases = new Set<string>();

  phrases.add(input.summary.trim());
  if (input.description?.trim()) {
    phrases.add(input.description.trim().slice(0, 300));
  }

  for (const comp of input.components ?? []) {
    if (comp.trim()) phrases.add(comp.trim());
  }

  for (const path of extractPathLikeTokens(combined)) {
    phrases.add(path);
  }

  for (const term of extractDomainTerms(combined)) {
    phrases.add(term);
    if (term === "auth") phrases.add("authentication session");
    if (term === "billing") phrases.add("billing limits checkout");
  }

  const boosts = getBoostedPatternTags(input.components ?? []);
  for (const tag of boosts) {
    phrases.add(tag.replace(/-/g, " "));
  }

  return [...phrases].filter((p) => p.length > 2).slice(0, 8);
}

async function expandQueryWithLlm(input: QueryExpansionInput): Promise<string[]> {
  if (!isOpenAIConfigured()) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);

  try {
    const response = await createChatCompletion({
      model: "gpt-4o-mini",
      temperature: 0.2,
      maxTokens: 200,
      messages: [
        {
          role: "system",
          content:
            "Return JSON only: { \"phrases\": string[] } with 3-6 short technical search phrases for finding relevant source files in a codebase. Include likely directory names (e.g. server/src/billing). No prose.",
        },
        {
          role: "user",
          content: `Summary: ${input.summary}\nDescription: ${(input.description ?? "").slice(0, 500)}\nComponents: ${(input.components ?? []).join(", ")}`,
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]) as { phrases?: string[] };
    return (parsed.phrases ?? []).filter((p) => typeof p === "string" && p.length > 2).slice(0, 6);
  } catch (err) {
    logger.debug({ err }, "queryExpander LLM skipped");
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function expandTicketQueries(input: QueryExpansionInput): Promise<string[]> {
  const rules = expandQueryRules(input);
  const llm = await expandQueryWithLlm(input);
  const merged = [...new Set([...rules, ...llm])];
  return merged.slice(0, 10);
}
