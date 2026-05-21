function extractTextFromAdf(node: unknown): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (typeof node === "object" && node !== null && "text" in node) {
    return String((node as { text?: string }).text || "");
  }
  if (
    typeof node === "object" &&
    node !== null &&
    "content" in node &&
    Array.isArray((node as { content?: unknown[] }).content)
  ) {
    return (node as { content: unknown[] }).content
      .map(extractTextFromAdf)
      .join("");
  }
  return "";
}

export function parseDescription(description: unknown): string {
  if (!description) return "";
  if (typeof description === "string") return description;
  if (typeof description === "object") return extractTextFromAdf(description).trim();
  return String(description);
}
