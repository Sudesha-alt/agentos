import { Router, type Request } from "express";
import {
  buildGoogleAuthorizeUrl,
  exchangeGoogleCode,
  fetchGoogleUserProfile,
  googleOAuthRedirectUri,
  isGoogleOAuthConfigured,
} from "../../auth/googleOAuth";
import {
  consumeGoogleAuthHandoffCode,
  createGoogleAuthHandoffCode,
  createGoogleAuthState,
  validateGoogleAuthState,
} from "../../auth/googleOAuthState";
import { findOrCreateGoogleUser } from "../../auth/googleUser";
import { frontendBaseUrl } from "../../shared/frontendUrls";
import { logger } from "../../utils/logger";
import { issueSessionForUserId, type AuthSessionResponse } from "./authSession";

const router = Router();

function publicApiBase(req: Request): string {
  if (process.env.PUBLIC_API_URL?.trim()) {
    return process.env.PUBLIC_API_URL.replace(/\/$/, "");
  }
  const proto = req.header("x-forwarded-proto") || req.protocol || "https";
  const host = req.header("x-forwarded-host") || req.get("host") || "localhost:4000";
  return `${proto}://${host}`;
}

function frontendGoogleCallbackUrl(query = ""): string {
  const base = frontendBaseUrl() || "http://localhost:5173";
  const path = "/auth/google/callback";
  return query ? `${base}${path}?${query}` : `${base}${path}`;
}

async function ensureOnboardingForUser(user: { id: string; email: string; name: string }) {
  const { ensureOnboarding } = await import("../../onboarding/store");
  await ensureOnboarding({
    userId: user.id,
    email: user.email,
    name: user.name,
    completed: false,
  });
}

async function buildSessionForGoogleUser(userId: string): Promise<AuthSessionResponse> {
  const { prisma } = await import("../../db/client");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  await ensureOnboardingForUser(user);
  return issueSessionForUserId(userId);
}

router.get("/status", (_req, res) => {
  res.json({
    googleAvailable: isGoogleOAuthConfigured(),
    callbackUrl: googleOAuthRedirectUri(
      process.env.PUBLIC_API_URL?.trim() || "http://localhost:4000"
    ),
  });
});

router.get("/start", (req, res) => {
  if (!isGoogleOAuthConfigured()) {
    res.status(503).json({
      error: "google_oauth_not_configured",
      message: "Google sign-in is not configured on this server.",
    });
    return;
  }

  const returnTo = typeof req.query.returnTo === "string" ? req.query.returnTo : undefined;
  const redirectUri = googleOAuthRedirectUri(publicApiBase(req));
  const state = createGoogleAuthState(returnTo);
  const url = buildGoogleAuthorizeUrl({ redirectUri, state });
  res.redirect(url);
});

router.get("/callback", async (req, res) => {
  const oauthError = String(req.query.error ?? "");
  const stateParam = String(req.query.state ?? "");
  const state = validateGoogleAuthState(stateParam);

  if (oauthError) {
    res.redirect(
      frontendGoogleCallbackUrl(`error=${encodeURIComponent(oauthError)}`)
    );
    return;
  }

  const code = String(req.query.code ?? "");
  if (!code || !state) {
    res.redirect(frontendGoogleCallbackUrl("error=invalid_state"));
    return;
  }

  const redirectUri = googleOAuthRedirectUri(publicApiBase(req));

  try {
    const tokens = await exchangeGoogleCode(code, redirectUri);
    const profile = await fetchGoogleUserProfile(tokens.access_token);
    const user = await findOrCreateGoogleUser(profile);
    const session = await buildSessionForGoogleUser(user.id);
    const handoff = createGoogleAuthHandoffCode(JSON.stringify(session));

    const params = new URLSearchParams({ code: handoff });
    if (state.returnTo) {
      params.set("returnTo", state.returnTo);
    }
    res.redirect(frontendGoogleCallbackUrl(params.toString()));
  } catch (err) {
    logger.error({ err }, "google oauth callback failed");
    const message = err instanceof Error ? err.message : "google_auth_failed";
    const code =
      message === "google_account_conflict" ? "google_account_conflict" : "google_auth_failed";
    res.redirect(frontendGoogleCallbackUrl(`error=${encodeURIComponent(code)}`));
  }
});

router.post("/complete", (req, res) => {
  const handoffCode = String(req.body?.code ?? "");
  const sessionJson = consumeGoogleAuthHandoffCode(handoffCode);
  if (!sessionJson) {
    res.status(401).json({
      error: "invalid_handoff",
      message: "Google sign-in link expired or is invalid. Try again.",
    });
    return;
  }

  try {
    const session = JSON.parse(sessionJson) as AuthSessionResponse;
    res.json(session);
  } catch {
    res.status(500).json({
      error: "invalid_handoff",
      message: "Could not complete Google sign-in.",
    });
  }
});

export default router;
