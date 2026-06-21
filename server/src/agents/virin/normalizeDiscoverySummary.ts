/** LLM sometimes returns discoverySummary as a structured object — coerce to prompt/UI text. */
export function normalizeDiscoverySummary(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v != null && String(v).trim())
      .map(([k, v]) => `${k.replace(/_/g, " ")}: ${String(v).trim()}`)
      .join("\n\n");
  }
  return String(value).trim();
}
