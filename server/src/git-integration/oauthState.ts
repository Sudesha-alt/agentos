import crypto from "node:crypto";

const STATE_TTL_MS = 15 * 60 * 1000;

function stateSecret(): string {
  return (
    process.env.GITHUB_OAUTH_STATE_SECRET?.trim() ??
    process.env.GITHUB_APP_WEBHOOK_SECRET?.trim() ??
    process.env.GITHUB_APP_PRIVATE_KEY?.trim()?.slice(0, 64) ??
    "agentos-dev-oauth-state"
  );
}

function signPayload(signInput: string): string {
  return crypto.createHmac("sha256", stateSecret()).update(signInput).digest("base64url");
}

/** Signed OAuth state; optionally binds organizationId and slug for multi-tenant install. */
export function createOAuthState(
  organizationId?: string,
  organizationSlug?: string
): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  const ts = Date.now().toString();
  const payload =
    organizationId?.trim()
      ? Buffer.from(
          JSON.stringify({
            organizationId: organizationId.trim(),
            organizationSlug: organizationSlug?.trim() || undefined,
          })
        ).toString("base64url")
      : "";
  const signInput = payload ? `${nonce}.${ts}.${payload}` : `${nonce}.${ts}`;
  const sig = signPayload(signInput);
  const raw = payload ? `${nonce}.${ts}.${payload}.${sig}` : `${nonce}.${ts}.${sig}`;
  return Buffer.from(raw).toString("base64url");
}

export type ParsedOAuthState = {
  valid: boolean;
  organizationId?: string;
  organizationSlug?: string;
};

export function parseOAuthState(state: string | undefined | null): ParsedOAuthState {
  if (!state?.trim()) return { valid: false };
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length < 3) return { valid: false };

    let nonce: string;
    let ts: string;
    let payloadB64: string | undefined;
    let sig: string;

    if (parts.length === 3) {
      [nonce, ts, sig] = parts as [string, string, string];
    } else {
      [nonce, ts, payloadB64, sig] = parts as [string, string, string, string];
    }

    if (!nonce || !ts || !sig) return { valid: false };
    const age = Date.now() - Number(ts);
    if (!Number.isFinite(age) || age < 0 || age > STATE_TTL_MS) return { valid: false };

    const signInput = payloadB64 ? `${nonce}.${ts}.${payloadB64}` : `${nonce}.${ts}`;
    const expected = signPayload(signInput);
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return { valid: false };
    }

    let organizationId: string | undefined;
    let organizationSlug: string | undefined;
    if (payloadB64) {
      try {
        const parsed = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as {
          organizationId?: string;
          organizationSlug?: string;
        };
        organizationId = parsed.organizationId?.trim() || undefined;
        organizationSlug = parsed.organizationSlug?.trim() || undefined;
      } catch {
        return { valid: false };
      }
    }

    return { valid: true, organizationId, organizationSlug };
  } catch {
    return { valid: false };
  }
}

export function validateOAuthState(state: string | undefined | null): boolean {
  return parseOAuthState(state).valid;
}
