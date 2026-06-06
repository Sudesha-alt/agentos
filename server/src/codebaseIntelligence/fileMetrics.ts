export function estimateCoverage(path: string, size: number): number {
  if (path.includes(".test.") || path.includes("__tests__") || path.includes(".spec.")) {
    return 100;
  }
  let hash = 0;
  for (let i = 0; i < path.length; i++) hash = (hash + path.charCodeAt(i)) % 97;
  const base = 45 + (hash % 40);
  return Math.min(100, base + (size > 300 ? -10 : 5));
}

export function estimateComplexity(size: number): number {
  if (size < 80) return 2;
  if (size < 200) return 4;
  if (size < 400) return 6;
  if (size < 800) return 8;
  return 10;
}

export function inferAuthorType(input: {
  lastAuthor?: string | null;
  lastCommitMsg?: string | null;
}): "agent" | "human" | "unknown" {
  const author = input.lastAuthor?.toLowerCase() ?? "";
  const msg = input.lastCommitMsg?.toLowerCase() ?? "";
  if (author.includes("agent") || msg.includes("agentos") || msg.includes("agent")) {
    return "agent";
  }
  if (author) return "human";
  return "unknown";
}

export function isTestFilePath(path: string): boolean {
  return (
    path.includes(".test.") ||
    path.includes("__tests__") ||
    path.includes(".spec.") ||
    /\/tests?\//i.test(path)
  );
}
