/** Frontend URL helpers for OAuth redirects and setup links. */

export function frontendBaseUrl(): string {
  const configured = process.env.FRONTEND_URL?.trim();
  if (!configured) return "";
  let base = configured.replace(/\/$/, "");
  base = base.replace(/\/app(\/.*)?$/i, "");
  return base;
}

export function frontendIntegrationUrl(
  orgSlug: string,
  integration: "github" | "jira"
): string {
  const base = frontendBaseUrl();
  if (!base || !orgSlug.trim()) return "";
  return `${base}/${orgSlug.trim()}/settings/integrations/${integration}`;
}
