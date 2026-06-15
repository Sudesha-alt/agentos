import { AUTH_SESSION_STORAGE_KEY } from "../../entities/auth";

export function authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
  if (!raw) return {};
  try {
    const session = JSON.parse(raw);
    return session?.token ? { Authorization: `Bearer ${session.token}` } : {};
  } catch {
    return {};
  }
}
