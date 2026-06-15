import { getActiveOrganizationId } from "../organization/context";
import {
  loadOrganizationJiraConfig,
  saveOrganizationJiraOAuthTokens,
} from "../organization/jiraConfigStore";
import {
  activateOrganizationJiraContext,
  warmOrganizationJiraCredentials,
} from "../pipeline/jira/credentialsStore";
import { refreshAtlassianToken } from "./atlassianOAuth";

const REFRESH_BUFFER_MS = 5 * 60 * 1000;

const refreshInFlight = new Map<string, Promise<void>>();

function tokenNeedsRefresh(expiresAt: Date | null | undefined): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() - Date.now() <= REFRESH_BUFFER_MS;
}

export async function ensureFreshJiraOAuthToken(
  organizationId?: string
): Promise<void> {
  const orgId = organizationId ?? getActiveOrganizationId();
  if (!orgId) return;

  const creds = await loadOrganizationJiraConfig(orgId);
  if (!creds || creds.authMethod !== "oauth") return;
  if (!creds.refreshToken) return;
  if (!tokenNeedsRefresh(creds.tokenExpiresAt ?? null)) return;

  const existing = refreshInFlight.get(orgId);
  if (existing) {
    await existing;
    return;
  }

  const task = (async () => {
    const latest = await loadOrganizationJiraConfig(orgId);
    if (!latest || latest.authMethod !== "oauth" || !latest.refreshToken) {
      return;
    }
    if (!tokenNeedsRefresh(latest.tokenExpiresAt ?? null)) {
      return;
    }

    const tokens = await refreshAtlassianToken(latest.refreshToken);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await saveOrganizationJiraOAuthTokens(orgId, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? latest.refreshToken,
      tokenExpiresAt: expiresAt,
      scopes: tokens.scope ?? latest.scopes,
    });

    await warmOrganizationJiraCredentials(orgId);
    if (getActiveOrganizationId() === orgId) {
      activateOrganizationJiraContext(orgId);
    }
  })();

  refreshInFlight.set(orgId, task);
  try {
    await task;
  } finally {
    refreshInFlight.delete(orgId);
  }
}
