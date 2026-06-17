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

export function nameToSlug(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "workspace"
  );
}
