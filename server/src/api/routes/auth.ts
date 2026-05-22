import { Router } from "express";
import crypto from "crypto";

const router = Router();

type SessionRecord = {
  user: { id: string; email: string; name: string };
  issuedAt: string;
};

const sessions = new Map<string, SessionRecord>();

const DEMO_EMAIL = "demo@agentos.ai";
const DEMO_PASSWORD = "agentos123";

function displayName(email: string): string {
  const localPart = email.split("@")[0] || "operator";
  return (
    localPart
      .split(/[._-]+/)
      .filter(Boolean)
      .map((segment) => segment[0].toUpperCase() + segment.slice(1))
      .join(" ") || "Workspace User"
  );
}

function createSession(email: string) {
  const token = crypto.randomBytes(24).toString("hex");
  const issuedAt = new Date().toISOString();
  const user = {
    id: `usr_${email.split("@")[0].toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
    email,
    name: displayName(email),
  };
  sessions.set(token, { user, issuedAt });
  return { token, issuedAt, user };
}

function extractToken(req: {
  header: (name: string) => string | undefined;
  query: { token?: string };
}): string | undefined {
  const header = req.header("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  if (typeof req.query.token === "string") {
    return req.query.token;
  }
  return undefined;
}

router.post("/login", (req, res) => {
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
  if (!demoOk && !anyWorkspaceLogin) {
    res.status(401).json({
      error: "invalid_credentials",
      message: `Use demo credentials or set AUTH_ALLOW_ANY_LOGIN=true on the server`,
    });
    return;
  }

  res.json(createSession(email));
});

router.get("/session", (req, res) => {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const record = sessions.get(token);
  if (!record) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  res.json({
    token,
    issuedAt: record.issuedAt,
    user: record.user,
  });
});

router.post("/logout", (req, res) => {
  const token = extractToken(req);
  if (token) sessions.delete(token);
  res.json({ ok: true });
});

export default router;
