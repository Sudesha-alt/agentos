import { Router } from "express";
import { prisma } from "../../db/client";
import { hashPassword, verifyPassword } from "../../auth/password";
import {
  buildPasswordResetUrl,
  createPasswordResetToken,
  resetPasswordWithToken,
} from "../../auth/passwordReset";
import { displayNameFromEmail } from "./authSession";
import {
  createAuthSession,
  extractAuthToken,
  revokeAuthToken,
} from "./authSession";
import { logger } from "../../utils/logger";
import authGoogleRouter from "./authGoogle";

const router = Router();

const DEMO_EMAIL = "demo@agentos.ai";
const DEMO_PASSWORD = "agentos123";

const INVALID_LOGIN_MESSAGE = "Incorrect email or password.";
const FORGOT_PASSWORD_MESSAGE =
  "If an account exists for that email, we sent password reset instructions.";

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

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({
      error: "email_exists",
      message: "An account with this email already exists. Sign in instead.",
    });
    return;
  }

  try {
    await prisma.user.create({
      data: {
        email,
        name: displayNameFromEmail(email),
        passwordHash: await hashPassword(password),
      },
    });
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
    res.status(401).json({
      error: "invalid_credentials",
      message: INVALID_LOGIN_MESSAGE,
    });
    return;
  }

  const demoOk = email === DEMO_EMAIL && password === DEMO_PASSWORD;
  const anyWorkspaceLogin = process.env.AUTH_ALLOW_ANY_LOGIN === "true";

  if (demoOk || anyWorkspaceLogin) {
    try {
      res.json(await createAuthSession(email));
    } catch (err) {
      res.status(500).json({
        error: "login_failed",
        message: err instanceof Error ? err.message : "Could not sign in",
      });
    }
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash) {
    res.status(401).json({
      error: "invalid_credentials",
      message: user
        ? "This account uses Google sign-in. Continue with Google instead."
        : INVALID_LOGIN_MESSAGE,
    });
    return;
  }
  const passwordOk = await verifyPassword(password, user.passwordHash);

  if (!user || !passwordOk) {
    res.status(401).json({
      error: "invalid_credentials",
      message: INVALID_LOGIN_MESSAGE,
    });
    return;
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

router.post("/forgot-password", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();

  if (!email || !email.includes("@")) {
    res.status(400).json({ error: "invalid_email", message: "Valid email required" });
    return;
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && email !== DEMO_EMAIL) {
      const token = await createPasswordResetToken(user.id);
      const resetUrl = buildPasswordResetUrl(token);
      if (process.env.NODE_ENV !== "production") {
        logger.info({ email, resetUrl }, "password reset link (dev)");
      }
      // Hook for transactional email when configured.
      if (process.env.PASSWORD_RESET_WEBHOOK_URL?.trim()) {
        try {
          await fetch(process.env.PASSWORD_RESET_WEBHOOK_URL.trim(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, resetUrl }),
          });
        } catch (err) {
          logger.warn({ err, email }, "password reset webhook failed");
        }
      }
    }
  } catch (err) {
    logger.warn({ err, email }, "forgot-password failed");
  }

  res.json({ ok: true, message: FORGOT_PASSWORD_MESSAGE });
});

router.post("/reset-password", async (req, res) => {
  const token = String(req.body?.token ?? "").trim();
  const password = String(req.body?.password ?? "");

  if (!token) {
    res.status(400).json({ error: "invalid_token", message: "Reset link is invalid" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({
      error: "invalid_password",
      message: "Password must be at least 8 characters",
    });
    return;
  }

  const ok = await resetPasswordWithToken(token, password);
  if (!ok) {
    res.status(400).json({
      error: "invalid_token",
      message: "This reset link is invalid or has expired. Request a new one.",
    });
    return;
  }

  res.json({ ok: true, message: "Password updated. You can sign in now." });
});

router.get("/session", async (req, res) => {
  const { resolveSessionFromAuthHeader, resolveUserFromAuthHeader, issueSessionForUserId } =
    await import("./authSession");

  const fastSession = resolveSessionFromAuthHeader(req);
  if (fastSession) {
    res.json(fastSession);
    return;
  }

  const user = resolveUserFromAuthHeader(req);
  if (!user) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  try {
    res.json(await issueSessionForUserId(user.id));
  } catch (err) {
    res.status(500).json({
      error: "session_refresh_failed",
      message: err instanceof Error ? err.message : "Could not refresh session",
    });
  }
});

router.post("/logout", (req, res) => {
  const token = extractAuthToken(req);
  if (token) revokeAuthToken(token);
  res.json({ ok: true });
});

router.use("/google", authGoogleRouter);

export default router;
