import { apiPath } from "../../shared/config/apiBase";
import { authHeaders } from "../../shared/lib/authHeaders";
import { fetchJson } from "../../shared/lib/fetchJson";
import { AUTH_SESSION_STORAGE_KEY } from "../auth";

export async function fetchOrganizationsByDomain() {
  return fetchJson(apiPath("/api", "/organization/by-domain"), {
    headers: authHeaders(),
  });
}

export async function createOrganization(name) {
  const session = await fetchJson(apiPath("/api", "/organization/create"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(name ? { name } : {}),
  });
  if (typeof window !== "undefined" && session?.token) {
    window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
  }
  return session;
}

export async function joinOrganization(organizationId) {
  const session = await fetchJson(apiPath("/api", "/organization/join"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ organizationId }),
  });
  if (typeof window !== "undefined" && session?.token) {
    window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
  }
  return session;
}
