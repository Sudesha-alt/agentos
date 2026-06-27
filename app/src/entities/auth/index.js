import {
  AuthSessionSchema,
  LoginRequestSchema,
  LoginResponseSchema,
  SignupRequestSchema,
} from "../../contracts";
import { apiPath } from "../../shared/config/apiBase";
import { DATA_MODE } from "../../shared/config/app";
import { fetchJson, formatApiError } from "../../shared/lib/fetchJson";

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

function buildMockOrganization(email) {
  const domain = email.split("@")[1]?.toLowerCase() || "workspace.local";
  const label = domain.split(".")[0] || "workspace";
  const slug = label.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "workspace";
  const orgId = `org_${slug}`;
  return {
    id: orgId,
    name: label.charAt(0).toUpperCase() + label.slice(1),
    domain,
    slug,
    role: "OWNER",
  };
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
  const organization = onboardingCompleted ? buildMockOrganization(email) : undefined;

  return AuthSessionSchema.parse({
    token: `mock_${Math.random().toString(36).slice(2)}`,
    issuedAt: new Date().toISOString(),
    user: {
      id: userId,
      email,
      name: name || "Workspace User",
      organizationId: organization?.id,
      organizationSlug: organization?.slug,
      organizationName: organization?.name,
      organizationDomain: organization?.domain,
      organizationRole: organization?.role,
    },
    organization,
    onboardingCompleted,
  });
}

function authHeaders(session) {
  if (!session?.token) return {};
  return { Authorization: `Bearer ${session.token}` };
}

function authJsonFetch(path, init = {}) {
  return fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    ...init,
  }).then(async (res) => {
    const text = await res.text().catch(() => "");
    let body = {};
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { message: text };
      }
    }
    if (!res.ok) {
      throw new Error(formatApiError(text, res.status));
    }
    return body;
  });
}

const mockAuthAdapter = {
  async getSession() {
    return readStoredSession();
  },
  async getGoogleAuthStatus() {
    return { googleAvailable: false };
  },
  getGoogleAuthStartUrl() {
    throw new Error("Google sign-in is not available in mock mode.");
  },
  async completeGoogleAuth() {
    throw new Error("Google sign-in is not available in mock mode.");
  },
  async login(payload) {
    const parsed = LoginRequestSchema.parse(payload);
    const registered = readRegisteredEmails();
    if (!registered.has(parsed.email) && parsed.email !== DEMO_CREDENTIAL_HINT.email) {
      throw new Error("Incorrect email or password.");
    }
    if (parsed.email !== DEMO_CREDENTIAL_HINT.email && registered.has(parsed.email)) {
      const stored =
        typeof window !== "undefined"
          ? window.localStorage.getItem(`agentos.auth.password.${parsed.email}`)
          : null;
      if (stored && stored !== parsed.password) {
        throw new Error("Incorrect email or password.");
      }
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
    if (typeof window !== "undefined") {
      window.localStorage.setItem(`agentos.auth.password.${parsed.email}`, parsed.password);
    }
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
  async requestPasswordReset({ email }) {
    return {
      ok: true,
      message:
        "If an account exists for that email, we sent password reset instructions.",
    };
  },
  async resetPassword({ token, password }) {
    if (!token?.trim()) {
      throw new Error("This reset link is invalid or has expired. Request a new one.");
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem("agentos.auth.mockResetPassword", password);
    }
    return { ok: true, message: "Password updated. You can sign in now." };
  },
};

const restAuthAdapter = {
  async getSession() {
    const stored = readStoredSession();
    if (!stored?.token) return null;

    try {
      const res = await fetch(apiPath("/api", "/auth/session"), {
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(stored),
        },
      });

      if (res.status === 401) {
        clearStoredSession();
        return null;
      }

      if (!res.ok) {
        return stored;
      }

      const data = await res.json();

      if (data?.organization && !data.organization.slug && stored.organization?.slug) {
        data.organization.slug = stored.organization.slug;
      }

      try {
        const session = AuthSessionSchema.parse(data);
        persistSession(session);
        return session;
      } catch {
        return stored;
      }
    } catch {
      return stored;
    }
  },
  async login(payload) {
    const parsed = LoginRequestSchema.parse(payload);
    const session = LoginResponseSchema.parse(
      await authJsonFetch(apiPath("/api", "/auth/login"), {
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
      await authJsonFetch(apiPath("/api", "/auth/signup"), {
        method: "POST",
        body: JSON.stringify(parsed),
      })
    );
    persistSession(session);
    return session;
  },
  async requestPasswordReset(payload) {
    return authJsonFetch(apiPath("/api", "/auth/forgot-password"), {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  async resetPassword(payload) {
    return authJsonFetch(apiPath("/api", "/auth/reset-password"), {
      method: "POST",
      body: JSON.stringify(payload),
    });
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
  async getGoogleAuthStatus() {
    try {
      return await authJsonFetch(apiPath("/api", "/auth/google/status"));
    } catch {
      return { googleAvailable: false };
    }
  },
  getGoogleAuthStartUrl(returnTo = "/app") {
    const params = new URLSearchParams({ returnTo });
    return apiPath("/api", `/auth/google/start?${params.toString()}`);
  },
  async completeGoogleAuth(code) {
    const session = LoginResponseSchema.parse(
      await authJsonFetch(apiPath("/api", "/auth/google/complete"), {
        method: "POST",
        body: JSON.stringify({ code }),
      })
    );
    persistSession(session);
    return session;
  },
};

export const authAdapter =
  DATA_MODE === "rest" ? restAuthAdapter : mockAuthAdapter;

export function requestPasswordReset(payload) {
  return authAdapter.requestPasswordReset(payload);
}

export function resetPassword(payload) {
  return authAdapter.resetPassword(payload);
}

export function getGoogleAuthStatus() {
  return authAdapter.getGoogleAuthStatus();
}

export function getGoogleAuthStartUrl(returnTo) {
  return authAdapter.getGoogleAuthStartUrl(returnTo);
}

export function completeGoogleAuth(code) {
  return authAdapter.completeGoogleAuth(code);
}
