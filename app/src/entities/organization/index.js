import { AuthSessionSchema } from "../../contracts";
import { apiPath } from "../../shared/config/apiBase";
import { DATA_MODE, DATA_MODES } from "../../shared/config/app";
import { authHeaders } from "../../shared/lib/authHeaders";
import { fetchJson } from "../../shared/lib/fetchJson";
import { AUTH_SESSION_STORAGE_KEY } from "../auth";

function readStoredSession() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    return AuthSessionSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

function persistSession(session) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
  }
}

function slugify(value) {
  return (
    String(value)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "workspace"
  );
}

function buildMockOrganization(email, name) {
  const domain = email.split("@")[1]?.toLowerCase() || "workspace.local";
  const slug = slugify(name || domain.split(".")[0] || "workspace");
  return {
    id: `org_${slug}`,
    name: name || slug.charAt(0).toUpperCase() + slug.slice(1),
    domain,
    slug,
    role: "OWNER",
  };
}

function applyOrganizationToSession(session, organization) {
  const next = AuthSessionSchema.parse({
    ...session,
    user: {
      ...session.user,
      organizationId: organization.id,
      organizationName: organization.name,
      organizationDomain: organization.domain,
      organizationSlug: organization.slug,
      organizationRole: organization.role,
    },
    organization,
  });
  persistSession(next);
  return next;
}

const mockOrganizationAdapter = {
  async fetchByDomain() {
    const session = readStoredSession();
    if (!session?.user?.email) {
      return { domain: "", organizations: [], currentOrganizationId: null };
    }
    const domain = session.user.email.split("@")[1]?.toLowerCase() ?? "";
    return {
      domain,
      organizations: [],
      currentOrganizationId: session.user.organizationId ?? null,
    };
  },
  async create(name) {
    const session = readStoredSession();
    if (!session?.user?.email) {
      throw new Error("Sign in to create a workspace.");
    }
    const organization = buildMockOrganization(session.user.email, name);
    return applyOrganizationToSession(session, organization);
  },
  async join(organizationId) {
    const session = readStoredSession();
    if (!session?.user?.email) {
      throw new Error("Sign in to join a workspace.");
    }
    const organization = {
      id: organizationId,
      name: "Team workspace",
      domain: session.user.email.split("@")[1]?.toLowerCase() || "workspace.local",
      slug: slugify(organizationId),
      role: "MEMBER",
    };
    return applyOrganizationToSession(session, organization);
  },
};

const restOrganizationAdapter = {
  async fetchByDomain() {
    return fetchJson(apiPath("/api", "/organization/by-domain"), {
      headers: authHeaders(),
    });
  },
  async create(name) {
    const session = await fetchJson(apiPath("/api", "/organization/create"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(name ? { name } : {}),
    });
    if (typeof window !== "undefined" && session?.token) {
      persistSession(session);
    }
    return session;
  },
  async join(organizationId) {
    const session = await fetchJson(apiPath("/api", "/organization/join"), {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ organizationId }),
    });
    if (typeof window !== "undefined" && session?.token) {
      persistSession(session);
    }
    return session;
  },
};

const organizationAdapter =
  DATA_MODE === DATA_MODES.REST ? restOrganizationAdapter : mockOrganizationAdapter;

export async function fetchOrganizationsByDomain() {
  return organizationAdapter.fetchByDomain();
}

export async function createOrganization(name) {
  return organizationAdapter.create(name);
}

export async function joinOrganization(organizationId) {
  return organizationAdapter.join(organizationId);
}
