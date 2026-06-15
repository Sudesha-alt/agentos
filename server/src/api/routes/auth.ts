import { Router } from "express";
import {
  createAuthSession,
  extractAuthToken,
  getSessionsMap,
  isEmailRegistered,
  registerEmail,
} from "./authSession";
import { getOnboarding } from "../../onboarding/store";

const router = Router();
const sessions = getSessionsMap();

const DEMO_EMAIL = "demo@agentos.ai";
const DEMO_PASSWORD = "agentos123";

router.post("/signup", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");

  if (!email || !email.includes("@")) {
    res.status(400).json({ error: "invalid_email", message: "Valid email required" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({
      error: "invalid_password",
      message: "Password must be at least 8 characters",
    });
    return;
  }
  if (isEmailRegistered(email)) {
    res.status(409).json({
      error: "email_exists",
      message: "An account with this email already exists. Sign in instead.",
    });
    return;
  }

  registerEmail(email);
  try {
    res.json(await createAuthSession(email));
  } catch (err) {
    res.status(500).json({
      error: "signup_failed",
      message: err instanceof Error ? err.message : "Could not create account",
    });
  }
});

router.post("/login", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");

  if (!email || !email.includes("@")) {
    res.status(400).json({ error: "invalid_email", message: "Valid email required" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({
      error: "invalid_password",
      message: "Password must be at least 8 characters",
    });
    return;
  }

  const demoOk = email === DEMO_EMAIL && password === DEMO_PASSWORD;
  const anyWorkspaceLogin = process.env.AUTH_ALLOW_ANY_LOGIN === "true";

  if (!demoOk && !anyWorkspaceLogin && !isEmailRegistered(email)) {
    res.status(401).json({
      error: "account_not_found",
      message: "No account found for this email. Create an account first.",
    });
    return;
  }

  if (!demoOk && !anyWorkspaceLogin && isEmailRegistered(email)) {
    // Registered users: password check not persisted yet — accept valid length.
  } else if (!demoOk && !anyWorkspaceLogin) {
    res.status(401).json({
      error: "invalid_credentials",
      message: "Use demo credentials or set AUTH_ALLOW_ANY_LOGIN=true on the server",
    });
    return;
  }

  if (!isEmailRegistered(email) && (demoOk || anyWorkspaceLogin)) {
    registerEmail(email);
  }

  try {
    res.json(await createAuthSession(email));
  } catch (err) {
    res.status(500).json({
      error: "login_failed",
      message: err instanceof Error ? err.message : "Could not sign in",
    });
  }
});

router.get("/session", (req, res) => {
  const token = extractAuthToken(req);
  if (!token) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const record = sessions.get(token);
  if (!record) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const onboarding = getOnboarding(record.user.id);
  res.json({
    token,
    issuedAt: record.issuedAt,
    user: record.user,
    organization: {
      id: record.user.organizationId,
      name: record.user.organizationName,
      domain: record.user.organizationDomain,
      role: record.user.organizationRole,
    },
    onboardingCompleted: onboarding?.completed ?? false,
  });
});

router.post("/logout", (req, res) => {
  const token = extractAuthToken(req);
  if (token) sessions.delete(token);
  res.json({ ok: true });
});

export default router;
