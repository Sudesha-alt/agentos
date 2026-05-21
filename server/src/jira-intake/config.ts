import path from "path";

const serverRoot = path.join(__dirname, "..", "..");

function resolveSqlitePath(envPath: string | undefined): string {
  const p = envPath || "./data/jira-intake.db";
  return path.isAbsolute(p) ? p : path.join(serverRoot, p);
}

function normalizeJiraBaseUrl(url: string): string {
  const trimmed = String(url || "").trim();
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return trimmed.replace(/\?.*$/, "").replace(/\/$/, "");
  }
}

function parseList(value: string | undefined, fallback: string[] = []): string[] {
  if (!value || !String(value).trim()) return fallback;
  return String(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export const intakeConfig = {
  logLevel: process.env.LOG_LEVEL || "info",
  aiWorkerStatuses: parseList(process.env.AI_WORKER_STATUSES, ["AI Worker"]),
  sqlitePath: resolveSqlitePath(process.env.SQLITE_PATH),
  jira: {
    baseUrl: normalizeJiraBaseUrl(process.env.JIRA_BASE_URL || ""),
    email: process.env.JIRA_EMAIL || "",
    apiToken: process.env.JIRA_API_TOKEN || "",
    boardId: process.env.JIRA_BOARD_ID || "",
  },
};

export function validateJiraConfig(): void {
  const { baseUrl, email, apiToken, boardId } = intakeConfig.jira;
  const missing: string[] = [];
  if (!baseUrl) missing.push("JIRA_BASE_URL");
  if (!email) missing.push("JIRA_EMAIL");
  if (!apiToken) missing.push("JIRA_API_TOKEN");
  if (!boardId) missing.push("JIRA_BOARD_ID");
  if (missing.length) {
    throw new Error(`Missing Jira config: ${missing.join(", ")}`);
  }
}
