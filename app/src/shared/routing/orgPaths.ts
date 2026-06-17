/** Reserved first-path segments — cannot be used as organization slugs. */
export const RESERVED_SLUGS = new Set([
  "login",
  "onboarding",
  "roi",
  "contact",
  "app",
  "api",
  "forgot-password",
  "reset-password",
  "r",
]);

export function isReservedSlug(slug: string | undefined | null): boolean {
  if (!slug?.trim()) return true;
  return RESERVED_SLUGS.has(slug.trim().toLowerCase());
}

/** Build an org-scoped app path: orgPath("acme", "pipelines") → "/acme/pipelines" */
export function orgPath(slug: string, ...segments: string[]): string {
  const base = `/${slug.replace(/^\/+|\/+$/g, "")}`;
  const tail = segments
    .flatMap((segment) => segment.split("/"))
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/");
  return tail ? `${base}/${tail}` : base;
}

/** Strip /:orgSlug prefix; returns path relative to org root ("" or "/pipelines"). */
export function orgRelativePath(pathname: string, slug: string): string {
  const prefix = `/${slug}`;
  if (pathname === prefix) return "";
  if (pathname.startsWith(`${prefix}/`)) {
    return pathname.slice(prefix.length);
  }
  return pathname;
}

export function orgPathMatches(
  pathname: string,
  slug: string,
  ...segments: string[]
): boolean {
  const target = orgPath(slug, ...segments);
  return pathname === target || pathname.startsWith(`${target}/`);
}

/** Path after org slug or legacy /app prefix (e.g. /acme/pipelines → /pipelines). */
export function appRelativePath(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return "/";
  if (parts[0] === "app" || !isReservedSlug(parts[0])) {
    const tail = parts.slice(1);
    return tail.length ? `/${tail.join("/")}` : "/";
  }
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

/** Default post-login destination for a session. */
export function sessionHomePath(session: {
  organization?: { slug?: string };
  user?: { organizationSlug?: string };
} | null | undefined): string {
  const slug = session?.organization?.slug ?? session?.user?.organizationSlug;
  if (slug) return orgPath(slug);
  return "/onboarding";
}

/** Legacy /app/... → org-scoped path when slug is known. */
export function migrateAppPath(slug: string, legacyPath: string): string {
  const normalized = legacyPath.replace(/^\/app\/?/, "");
  return orgPath(slug, normalized);
}
