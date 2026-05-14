import {
  AuthSessionSchema,
  LoginRequestSchema,
  LoginResponseSchema,
} from "../../contracts";
import { DATA_MODE } from "../../shared/config/app";
import { fetchJson } from "../../shared/lib/fetchJson";

const BASE = "/api";

export const AUTH_SESSION_STORAGE_KEY = "agentos.auth.session";

export const DEMO_CREDENTIAL_HINT = {
  email: "demo@agentos.ai",
  password: "agentos123",
};

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

const mockAuthAdapter = {
  async getSession() {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return null;
    try {
      return AuthSessionSchema.parse(JSON.parse(raw));
    } catch {
      window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      return null;
    }
  },
  async login(payload) {
    const parsed = LoginRequestSchema.parse(payload);
    const session = buildMockSession(parsed.email);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        AUTH_SESSION_STORAGE_KEY,
        JSON.stringify(session)
      );
    }
    return LoginResponseSchema.parse(session);
  },
  async logout() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    }
  },
};

const restAuthAdapter = {
  async getSession() {
    try {
      return AuthSessionSchema.parse(await fetchJson(`${BASE}/auth/session`));
    } catch {
      return null;
    }
  },
  async login(payload) {
    return LoginResponseSchema.parse(
      await fetchJson(`${BASE}/auth/login`, {
        method: "POST",
        body: JSON.stringify(LoginRequestSchema.parse(payload)),
      })
    );
  },
  async logout() {
    try {
      await fetchJson(`${BASE}/auth/logout`, {
        method: "POST",
      });
    } catch {
      // Keep logout resilient in case the session has already expired.
    }
  },
};

export const authAdapter = DATA_MODE === "rest" ? restAuthAdapter : mockAuthAdapter;
