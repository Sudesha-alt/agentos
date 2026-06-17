import { getBoostedPatternTags } from "./retrievalLearning";
import { createChatCompletion, isOpenAIConfigured } from "../llm/openaiClient";
import { logger } from "../utils/logger";

export interface TicketQueryInput {
  summary: string;
  description?: string;
  components?: string[];
  labels?: string[];
  issueType?: string;
}

const DOMAIN_TERMS = [
  "auth",
  "billing",
  "payment",
  "checkout",
  "api",
  "migration",
  "webhook",
  "regression",
  "performance",
  "bug",
  "config",
] as const;

export function expandTicketQueryRules(input: TicketQueryInput): string[] {
  const combined = [input.summary, input.description ?? "", ...(input.components ?? [])]
    .filter(Boolean)
    .join(" ");
  const phrases = new Set<string>();

  phrases.add(input.summary.trim());
  if (input.description?.trim()) {
    phrases.add(input.description.trim().slice(0, 400));
  }
  for (const c of input.components ?? []) {
    if (c.trim()) phrases.add(c.trim());
  }
  for (const term of DOMAIN_TERMS) {
    if (combined.toLowerCase().includes(term)) {
      phrases.add(term);
    }
  }
  for (const tag of getBoostedPatternTags(input.components ?? [])) {
    phrases.add(tag.replace(/-/g, " "));
  }

  return [...phrases].filter((p) => p.length > 2).slice(0, 8);
}

async function expandTicketQueryLlm(input: TicketQueryInput): Promise<string[]> {
  if (!isOpenAIConfigured()) return [];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  try {
    const response = await createChatCompletion({
      model: "gpt-4o-mini",
      temperature: 0.2,
      maxTokens: 180,
      messages: [
        {
          role: "system",
          content:
            'Return JSON only: { "phrases": string[] } with 3-5 short Jira search phrases (technical terms, error symptoms, feature names).',
        },
        {
          role: "user",
          content: `Summary: ${input.summary}\nDescription: ${(input.description ?? "").slice(0, 400)}\nComponents: ${(input.components ?? []).join(", ")}`,
        },
      ],
    });
    const raw = response.choices[0]?.message?.content ?? "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]) as { phrases?: string[] };
    return (parsed.phrases ?? []).filter((p) => typeof p === "string").slice(0, 5);
  } catch (err) {
    logger.debug({ err }, "ticket query LLM expand skipped");
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function expandTicketQueries(input: TicketQueryInput): Promise<string[]> {
  const rules = expandTicketQueryRules(input);
  const llm = await expandTicketQueryLlm(input);
  return [...new Set([...rules, ...llm])].slice(0, 10);
}

/** JQL strings for component / text search (used alongside vectors). */
export function buildJqlQueries(input: TicketQueryInput, excludeKey?: string): string[] {
  const queries: string[] = [];
  const exclude = excludeKey ? ` AND key != "${excludeKey}"` : "";

  for (const comp of (input.components ?? []).slice(0, 2)) {
    if (!comp.trim()) continue;
    queries.push(
      `component = "${comp.replace(/"/g, '\\"')}"${exclude} ORDER BY updated DESC`
    );
  }

  const firstTerm = input.summary.split(/\s+/).find((w) => w.length > 4);
  if (firstTerm) {
    queries.push(`text ~ "${firstTerm.replace(/"/g, '\\"')}"${exclude} ORDER BY updated DESC`);
  }

  return queries.slice(0, 3);
}
