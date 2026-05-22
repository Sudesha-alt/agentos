import {
  AuthSessionSchema,
  LoginRequestSchema,
  LoginResponseSchema,
} from "../../contracts";
import { apiPath } from "../../shared/config/apiBase";
import { DATA_MODE } from "../../shared/config/app";
import { fetchJson } from "../../shared/lib/fetchJson";

export const AUTH_SESSION_STORAGE_KEY = "agentos.auth.session";

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

function buildMockSession(email) {
  const localPart = email.split("@")[0] || "operator";
  const name = localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join(" ");

  return AuthSessionSchema.parse({
    token: `mock_${Math.random().toString(36).slice(2)}`,
    issuedAt: new Date().toISOString(),
    user: {
      id: `usr_${localPart.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
      email,
      name: name || "Workspace User",
    },
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
    const session = buildMockSession(parsed.email);
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
