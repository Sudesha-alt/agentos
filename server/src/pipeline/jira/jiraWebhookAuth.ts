import crypto from "node:crypto";

function decodeBase64Url(value: string): Buffer {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

/** Verify JWT bearer on OAuth 2.0 dynamic webhooks (signed with app client secret). */
export function verifyAtlassianOAuthWebhookJwt(
  token: string,
  clientSecret: string
): boolean {
  const segments = token.split(".");
  if (segments.length !== 3) return false;

  const [headerPart, payloadPart, signaturePart] = segments;
  let header: { alg?: string };
  try {
    header = JSON.parse(decodeBase64Url(headerPart).toString("utf8")) as {
      alg?: string;
    };
  } catch {
    return false;
  }

  const alg = header.alg ?? "HS256";
  if (alg !== "HS256" && alg !== "HS512") return false;

  const hashAlg = alg === "HS512" ? "sha512" : "sha256";
  const expected = crypto
    .createHmac(hashAlg, clientSecret)
    .update(`${headerPart}.${payloadPart}`)
    .digest();

  let actual: Buffer;
  try {
    actual = decodeBase64Url(signaturePart);
  } catch {
    return false;
  }

  try {
    if (expected.length !== actual.length) return false;
    if (!crypto.timingSafeEqual(expected, actual)) return false;
  } catch {
    return false;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(payloadPart).toString("utf8")) as {
      exp?: number;
    };
    if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
      return false;
    }
  } catch {
    return false;
  }

  return true;
}

export function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.trim()) return null;
  const [scheme, token] = authHeader.trim().split(/\s+/, 2);
  if (!token) return null;
  const normalized = scheme.toLowerCase();
  if (normalized === "bearer" || normalized === "jwt") {
    return token;
  }
  return null;
}
