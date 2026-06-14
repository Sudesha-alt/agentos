import crypto from "crypto";
import {
  ensureOnboarding,
  getOnboarding,
  seedDemoOnboarding,
} from "../../onboarding/store";

type SessionUser = { id: string; email: string; name: string };

const sessions = new Map<
  string,
  { user: SessionUser; issuedAt: string }
>();

const registeredEmails = new Set<string>(["demo@agentos.ai"]);

export function getSessionsMap() {
  return sessions;
}

export function getRegisteredEmails() {
  return registeredEmails;
}

export function extractAuthToken(req: {
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

export function resolveUserFromAuthHeader(req: {
  header: (name: string) => string | undefined;
  query: { token?: string };
}): SessionUser | null {
  const token = extractAuthToken(req);
  if (!token) return null;
  return sessions.get(token)?.user ?? null;
}

export function displayNameFromEmail(email: string): string {
  const localPart = email.split("@")[0] || "operator";
  return (
    localPart
      .split(/[._-]+/)
      .filter(Boolean)
      .map((segment) => segment[0].toUpperCase() + segment.slice(1))
      .join(" ") || "Workspace User"
  );
}

export function createAuthSession(email: string) {
  const user = {
    id: `usr_${email.split("@")[0].toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
    email,
    name: displayNameFromEmail(email),
  };
  const token = crypto.randomBytes(24).toString("hex");
  const issuedAt = new Date().toISOString();
  sessions.set(token, { user, issuedAt });

  if (email === "demo@agentos.ai") {
    seedDemoOnboarding(user.id, user.email, user.name);
  } else if (!getOnboarding(user.id)) {
    ensureOnboarding({
      userId: user.id,
      email: user.email,
      name: user.name,
      completed: false,
    });
  }

  const onboarding = getOnboarding(user.id);
  return {
    token,
    issuedAt,
    user,
    onboardingCompleted: onboarding?.completed ?? false,
  };
}

export function registerEmail(email: string) {
  registeredEmails.add(email);
}

export function isEmailRegistered(email: string) {
  return registeredEmails.has(email);
}
