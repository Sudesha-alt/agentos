import crypto from "node:crypto";

const STATE_TTL_MS = 15 * 60 * 1000;

export type JiraOAuthStatePayload = {
  organizationId: string;
  organizationSlug?: string;
  userId: string;
  nonce: string;
  ts: number;
};

function stateSecret(): string {
  return (
    process.env.ATLASSIAN_OAUTH_STATE_SECRET?.trim() ??
    process.env.ATLASSIAN_CLIENT_SECRET?.trim() ??
    process.env.AUTH_JWT_SECRET?.trim() ??
    "agentos-dev-jira-oauth-state"
  );
}

export function createJiraOAuthState(
  organizationId: string,
  userId: string,
  organizationSlug?: string
): string {
  const payload: JiraOAuthStatePayload = {
    organizationId,
    organizationSlug: organizationSlug?.trim() || undefined,
    userId,
    nonce: crypto.randomBytes(16).toString("hex"),
    ts: Date.now(),
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto
    .createHmac("sha256", stateSecret())
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

export function validateJiraOAuthState(
  state: string | undefined | null
): JiraOAuthStatePayload | null {
  if (!state?.trim()) return null;
  const parts = state.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;

  const expected = crypto
    .createHmac("sha256", stateSecret())
    .update(body)
    .digest("base64url");

  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as JiraOAuthStatePayload;
    if (!payload.organizationId || !payload.userId || !payload.nonce) {
      return null;
    }
    const age = Date.now() - Number(payload.ts);
    if (!Number.isFinite(age) || age < 0 || age > STATE_TTL_MS) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
