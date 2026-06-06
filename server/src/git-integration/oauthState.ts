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

export function createOAuthState(): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  const ts = Date.now().toString();
  const payload = `${nonce}.${ts}`;
  const sig = crypto
    .createHmac("sha256", stateSecret())
    .update(payload)
    .digest("base64url");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export function validateOAuthState(state: string | undefined | null): boolean {
  if (!state?.trim()) return false;
  try {
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const parts = decoded.split(".");
    if (parts.length !== 3) return false;
    const [nonce, ts, sig] = parts;
    if (!nonce || !ts || !sig) return false;
    const age = Date.now() - Number(ts);
    if (!Number.isFinite(age) || age < 0 || age > STATE_TTL_MS) return false;
    const payload = `${nonce}.${ts}`;
    const expected = crypto
      .createHmac("sha256", stateSecret())
      .update(payload)
      .digest("base64url");
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}
