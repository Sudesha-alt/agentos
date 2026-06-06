export const MAP_HIGHLIGHTS_KEY = "codebase-map-highlights";

export const SEARCH_PLACEHOLDERS = [
  "Where is authentication handled?",
  "Find payment processing logic",
  "Which files define API routes?",
  "Show database query patterns",
  "Where are tests for the pipeline?",
];

export const ASK_PLACEHOLDERS = [
  "How does the QA agent loop work?",
  "What files handle GitHub integration?",
  "Explain the codebase indexing flow",
  "Where should I add a new API endpoint?",
];

export function parentDir(filePath) {
  if (!filePath) return "";
  const parts = filePath.split("/");
  parts.pop();
  return parts.join("/");
}

export function setMapHighlights(paths) {
  if (!paths?.length) return;
  sessionStorage.setItem(MAP_HIGHLIGHTS_KEY, JSON.stringify(paths));
}

export function consumeMapHighlights() {
  try {
    const raw = sessionStorage.getItem(MAP_HIGHLIGHTS_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(MAP_HIGHLIGHTS_KEY);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((p) => typeof p === "string") : null;
  } catch {
    return null;
  }
}

/** Split answer text on [path/to/file] tokens for linkification */
export function splitAnswerWithPaths(text, knownPaths = []) {
  if (!text) return [{ type: "text", value: "" }];
  const pathSet = new Set(knownPaths);
  const parts = [];
  const re = /\[([^\]]+)\]/g;
  let last = 0;
  let match;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push({ type: "text", value: text.slice(last, match.index) });
    }
    const path = match[1];
    parts.push({
      type: pathSet.has(path) || path.includes("/") ? "path" : "text",
      value: path,
    });
    last = match.index + match[0].length;
  }

  if (last < text.length) {
    parts.push({ type: "text", value: text.slice(last) });
  }

  return parts.length ? parts : [{ type: "text", value: text }];
}

export function explorerUrl(filePath, { tab = "explorer" } = {}) {
  const params = new URLSearchParams();
  params.set("tab", tab);
  if (filePath) {
    params.set("file", filePath);
    const dir = parentDir(filePath);
    if (dir) params.set("dir", dir);
  }
  return `/app/codebase?${params.toString()}`;
}

export function mapHighlightUrl(paths) {
  setMapHighlights(paths);
  const params = new URLSearchParams({ tab: "map" });
  return `/app/codebase?${params.toString()}`;
}
