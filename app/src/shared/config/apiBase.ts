/**
 * In dev, paths stay relative (/api, /jira-intake) and Vite proxies to :4000.
 * In production, set VITE_API_URL to your deployed server (no trailing slash).
 */
export function apiOrigin(): string {
  const raw = import.meta.env.VITE_API_URL as string | undefined;
  return raw?.replace(/\/$/, "") ?? "";
}

export function apiPath(
  prefix: "/api" | "/jira-intake" | "/git-integration",
  path?: string
): string {
  if (path === undefined) {
    const full = prefix;
    const origin = apiOrigin();
    return origin ? `${origin}${full}` : full;
  }
  const segment = path.startsWith("/") ? path : `/${path}`;
  const full = `${prefix}${segment}`;
  const origin = apiOrigin();
  return origin ? `${origin}${full}` : full;
}
