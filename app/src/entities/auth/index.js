import {
  AuthSessionSchema,
  LoginRequestSchema,
  LoginResponseSchema,
  SignupRequestSchema,
} from "../../contracts";
import { apiPath } from "../../shared/config/apiBase";
import { DATA_MODE } from "../../shared/config/app";
import { fetchJson } from "../../shared/lib/fetchJson";

export const AUTH_SESSION_STORAGE_KEY = "agentos.auth.session";
const REGISTERED_EMAILS_KEY = "agentos.auth.registeredEmails";
const ONBOARDING_PREFIX = "agentos.onboarding.";

export const DEMO_CREDENTIAL_HINT = {
  email: "demo@agentos.ai",
  password: "agentos123",
};

function persistSession(session) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      AUTH_SESSION_STORAGE_KEY,
      JSON.stringify(session)
    );
  }
}

function readStoredSession() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    return AuthSessionSchema.parse(JSON.parse(raw));
  } catch {
    window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    return null;
  }
}

function clearStoredSession() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
  }
}

function readRegisteredEmails() {
  if (typeof window === "undefined") return new Set([DEMO_CREDENTIAL_HINT.email]);
  const raw = window.localStorage.getItem(REGISTERED_EMAILS_KEY);
  if (!raw) return new Set([DEMO_CREDENTIAL_HINT.email]);
  try {
    return new Set(JSON.parse(raw));
  } catch {
    return new Set([DEMO_CREDENTIAL_HINT.email]);
  }
}

function writeRegisteredEmails(set) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(REGISTERED_EMAILS_KEY, JSON.stringify([...set]));
  }
}

function readOnboardingCompleted(userId, email) {
  if (email === DEMO_CREDENTIAL_HINT.email) return true;
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(`${ONBOARDING_PREFIX}${userId}`);
  if (!raw) return false;
  try {
    return JSON.parse(raw).completed === true;
  } catch {
    return false;
  }
}

function buildMockSession(email, { isNewUser = false } = {}) {
  const localPart = email.split("@")[0] || "operator";
  const name = localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join(" ");

  const userId = `usr_${localPart.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`;
  const onboardingCompleted = isNewUser
    ? false
    : readOnboardingCompleted(userId, email);

  return AuthSessionSchema.parse({
    token: `mock_${Math.random().toString(36).slice(2)}`,
    issuedAt: new Date().toISOString(),
    user: {
      id: userId,
      email,
      name: name || "Workspace User",
    },
    onboardingCompleted,
  });
}

function authHeaders(session) {
  if (!session?.token) return {};
  return { Authorization: `Bearer ${session.token}` };
}

const mockAuthAdapter = {
  async getSession() {
    return readStoredSession();
  },
  async login(payload) {
    const parsed = LoginRequestSchema.parse(payload);
    const registered = readRegisteredEmails();
    if (!registered.has(parsed.email) && parsed.email !== DEMO_CREDENTIAL_HINT.email) {
      throw new Error("No account found for this email. Create an account first.");
    }
    const session = buildMockSession(parsed.email);
    persistSession(session);
    return LoginResponseSchema.parse(session);
  },
  async signup(payload) {
    const parsed = SignupRequestSchema.parse(payload);
    const registered = readRegisteredEmails();
    if (registered.has(parsed.email)) {
      throw new Error("An account with this email already exists. Sign in instead.");
    }
    registered.add(parsed.email);
    writeRegisteredEmails(registered);
    const session = buildMockSession(parsed.email, { isNewUser: true });
    const initialOnboarding = {
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name,
      companyStage: null,
      teamSize: null,
      role: null,
      completed: false,
      completedAt: null,
      updatedAt: new Date().toISOString(),
    };
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        `${ONBOARDING_PREFIX}${session.user.id}`,
        JSON.stringify(initialOnboarding)
      );
    }
    persistSession(session);
    return LoginResponseSchema.parse(session);
  },
  async logout() {
    clearStoredSession();
  },
};

const restAuthAdapter = {
  async getSession() {
    const stored = readStoredSession();
    if (!stored?.token) return null;
    try {
      return AuthSessionSchema.parse(
        await fetchJson(apiPath("/api", "/auth/session"), {
          headers: authHeaders(stored),
        })
      );
    } catch {
      clearStoredSession();
      return null;
    }
  },
  async login(payload) {
    const parsed = LoginRequestSchema.parse(payload);
    const session = LoginResponseSchema.parse(
      await fetchJson(apiPath("/api", "/auth/login"), {
        method: "POST",
        body: JSON.stringify(parsed),
      })
    );
    persistSession(session);
    return session;
  },
  async signup(payload) {
    const parsed = SignupRequestSchema.parse(payload);
    const session = LoginResponseSchema.parse(
      await fetchJson(apiPath("/api", "/auth/signup"), {
        method: "POST",
        body: JSON.stringify(parsed),
      })
    );
    persistSession(session);
    return session;
  },
  async logout() {
    const stored = readStoredSession();
    try {
      await fetchJson(apiPath("/api", "/auth/logout"), {
        method: "POST",
        headers: authHeaders(stored),
      });
    } catch {
      // Session may already be gone on the server.
    }
    clearStoredSession();
  },
};

export const authAdapter =
  DATA_MODE === "rest" ? restAuthAdapter : mockAuthAdapter;
