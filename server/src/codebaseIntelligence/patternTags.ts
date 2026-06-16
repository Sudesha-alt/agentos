export const KNOWN_PATTERN_TAGS = [
  "api-route",
  "database-query",
  "auth",
  "test",
  "service-layer",
  "ui-component",
  "utility",
  "module",
] as const;

export type PatternTag = (typeof KNOWN_PATTERN_TAGS)[number];

function normalizeQuery(q: string): string {
  return q.trim().toLowerCase();
}

export function detectPatternTags(query: string): string[] {
  const q = normalizeQuery(query);
  const tags: string[] = [];

  for (const tag of KNOWN_PATTERN_TAGS) {
    if (q === tag || q.includes(tag) || q.replace(/\s+/g, "-") === tag) {
      tags.push(tag);
    }
  }

  if (/\bapi\b|\broute\b|\bendpoint\b/.test(q) && !tags.includes("api-route")) {
    tags.push("api-route");
  }
  if (/\bdatabase\b|\bquery\b|\bprisma\b|\bsql\b/.test(q) && !tags.includes("database-query")) {
    tags.push("database-query");
  }
  if (/\bauth\b|\blogin\b|\bjwt\b|\bsession\b/.test(q) && !tags.includes("auth")) {
    tags.push("auth");
  }
  if (/\btest\b|\bspec\b|\bdescribe\b/.test(q) && !tags.includes("test")) {
    tags.push("test");
  }

  return [...new Set(tags)];
}
