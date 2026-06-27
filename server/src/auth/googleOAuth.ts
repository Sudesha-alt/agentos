const GOOGLE_AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

export const GOOGLE_OAUTH_SCOPES = ["openid", "email", "profile"];

export type GoogleUserProfile = {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
};

type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  scope?: string;
  token_type: string;
  id_token?: string;
};

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim()
  );
}

export function googleOAuthRedirectUri(reqBase?: string): string {
  const configured = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (configured) return configured.replace(/\/$/, "");
  if (reqBase) return `${reqBase.replace(/\/$/, "")}/api/auth/google/callback`;
  const publicApi = process.env.PUBLIC_API_URL?.trim();
  if (publicApi) return `${publicApi.replace(/\/$/, "")}/api/auth/google/callback`;
  return "http://localhost:4000/api/auth/google/callback";
}

export function buildGoogleAuthorizeUrl(input: {
  redirectUri: string;
  state: string;
}): string {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error("Google OAuth client ID is not configured");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: input.redirectUri,
    response_type: "code",
    scope: GOOGLE_OAUTH_SCOPES.join(" "),
    state: input.state,
    access_type: "online",
    prompt: "select_account",
  });

  return `${GOOGLE_AUTH_BASE}?${params.toString()}`;
}

export async function exchangeGoogleCode(
  code: string,
  redirectUri: string
): Promise<GoogleTokenResponse> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth client credentials are not configured");
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  const body = (await res.json().catch(() => ({}))) as GoogleTokenResponse & {
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !body.access_token) {
    throw new Error(
      body.error_description || body.error || "Google token exchange failed"
    );
  }

  return body;
}

export async function fetchGoogleUserProfile(
  accessToken: string
): Promise<GoogleUserProfile> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const body = (await res.json().catch(() => ({}))) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
    error?: { message?: string };
  };

  if (!res.ok || !body.sub || !body.email) {
    throw new Error(body.error?.message || "Could not load Google profile");
  }

  if (body.email_verified === false) {
    throw new Error("Google account email is not verified");
  }

  return {
    sub: body.sub,
    email: body.email.trim().toLowerCase(),
    emailVerified: body.email_verified !== false,
    name: body.name?.trim() || body.email.split("@")[0] || "Google User",
    picture: body.picture,
  };
}
