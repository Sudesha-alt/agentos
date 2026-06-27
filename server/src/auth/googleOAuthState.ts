import crypto from "node:crypto";

const STATE_TTL_MS = 15 * 60 * 1000;

export type GoogleAuthStatePayload = {
  nonce: string;
  ts: number;
  returnTo?: string;
};

function stateSecret(): string {
  return (
    process.env.GOOGLE_OAUTH_STATE_SECRET?.trim() ??
    process.env.GOOGLE_CLIENT_SECRET?.trim() ??
    process.env.AUTH_JWT_SECRET?.trim() ??
    "agentos-dev-google-oauth-state"
  );
}

export function createGoogleAuthState(returnTo?: string): string {
  const payload: GoogleAuthStatePayload = {
    nonce: crypto.randomBytes(16).toString("hex"),
    ts: Date.now(),
    returnTo: sanitizeReturnTo(returnTo),
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", stateSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function validateGoogleAuthState(
  state: string | undefined | null
): GoogleAuthStatePayload | null {
  if (!state?.trim()) return null;
  const parts = state.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;

  const expected = crypto.createHmac("sha256", stateSecret()).update(body).digest("base64url");
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
    ) as GoogleAuthStatePayload;
    if (!payload.nonce) return null;
    const age = Date.now() - Number(payload.ts);
    if (!Number.isFinite(age) || age < 0 || age > STATE_TTL_MS) {
      return null;
    }
    return {
      ...payload,
      returnTo: sanitizeReturnTo(payload.returnTo),
    };
  } catch {
    return null;
  }
}

function sanitizeReturnTo(returnTo?: string): string | undefined {
  const value = returnTo?.trim();
  if (!value) return undefined;
  if (!value.startsWith("/") || value.startsWith("//")) return undefined;
  return value;
}

const HANDOFF_TTL_MS = 60 * 1000;

export function createGoogleAuthHandoffCode(sessionJson: string): string {
  const payload = {
    session: sessionJson,
    exp: Date.now() + HANDOFF_TTL_MS,
    nonce: crypto.randomBytes(12).toString("hex"),
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = crypto.createHmac("sha256", stateSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function consumeGoogleAuthHandoffCode(code: string | undefined | null): string | null {
  if (!code?.trim()) return null;
  const parts = code.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;

  const expected = crypto.createHmac("sha256", stateSecret()).update(body).digest("base64url");
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
    ) as { session?: string; exp?: number };
    if (!payload.session || !payload.exp || Date.now() > payload.exp) {
      return null;
    }
    return payload.session;
  } catch {
    return null;
  }
}
