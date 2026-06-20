import { Router, type Request } from "express";
import {
  fetchAtlassianAccessibleResources,
  pickJiraCloudResource,
} from "../../jira-oauth/accessibleResources";
import {
  atlassianOAuthRedirectUri,
  buildAtlassianAuthorizeUrl,
  exchangeAtlassianCode,
  isAtlassianOAuthConfigured,
} from "../../jira-oauth/atlassianOAuth";
import { createJiraOAuthState, validateJiraOAuthState } from "../../jira-oauth/stateStore";
import {
  clearOrganizationJiraConfig,
  getPublicOrganizationJiraConfig,
  isAtlassianOAuthEnabled,
  saveOrganizationJiraOAuthConfig,
} from "../../organization/jiraConfigStore";
import {
  activateOrganizationJiraContext,
  savePipelineJiraOAuthCredentialsForOrganization,
  warmOrganizationJiraCredentials,
} from "../../pipeline/jira/credentialsStore";
import { fetchPipelineJiraCurrentUser } from "../../pipeline/jira/client";
import {
  connectPipelineJira,
  pipelineJiraWebhookUrl,
} from "../../pipeline/jira/connectPipelineJira";
import { logger } from "../../utils/logger";
import {
  frontendBaseUrl,
  frontendIntegrationUrl,
} from "../../shared/frontendUrls";
import {
  requireOrganizationUser,
  withOrganizationContext,
} from "../orgRequestContext";

const router = Router();

function publicApiBase(req: Request): string {
  if (process.env.PUBLIC_API_URL?.trim()) {
    return process.env.PUBLIC_API_URL.replace(/\/$/, "");
  }
  const proto = req.header("x-forwarded-proto") || req.protocol || "https";
  const host = req.header("x-forwarded-host") || req.get("host") || "localhost:4000";
  return `${proto}://${host}`;
}

async function resolveOrgSlug(
  organizationId: string | undefined,
  organizationSlug?: string
): Promise<string | undefined> {
  if (organizationSlug?.trim()) return organizationSlug.trim();
  if (!organizationId) return undefined;
  const { prisma } = await import("../../db/client");
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { slug: true },
  });
  return org?.slug;
}

function frontendJiraSettingsUrl(orgSlug?: string, query = ""): string {
  if (orgSlug?.trim()) {
    const url = frontendIntegrationUrl(orgSlug.trim(), "jira");
    return query ? `${url}?${query}` : url;
  }
  const base = frontendBaseUrl() || "http://localhost:5173";
  const path = "/app/settings/integrations/jira";
  return query ? `${base}${path}?${query}` : `${base}${path}`;
}

router.get("/start", async (req, res) => {
  const user = requireOrganizationUser(req, res);
  if (!user?.organizationId) return;

  if (!isAtlassianOAuthConfigured()) {
    res.status(503).json({
      error: "atlassian_oauth_not_configured",
      message:
        "Set ATLASSIAN_CLIENT_ID and ATLASSIAN_CLIENT_SECRET on the server.",
    });
    return;
  }

  const redirectUri = atlassianOAuthRedirectUri(publicApiBase(req));
  const slug = await resolveOrgSlug(user.organizationId, user.organizationSlug);
  const state = createJiraOAuthState(user.organizationId, user.id, slug);
  const url = buildAtlassianAuthorizeUrl(state, redirectUri);

  if (req.query.redirect === "1") {
    res.redirect(url);
    return;
  }

  res.json({ url, redirectUri });
});

router.get("/callback", async (req, res) => {
  const oauthError = String(req.query.error ?? "");
  const stateParam = String(req.query.state ?? "");
  const earlyPayload = validateJiraOAuthState(stateParam);
  const earlySlug = await resolveOrgSlug(
    earlyPayload?.organizationId,
    earlyPayload?.organizationSlug
  );

  if (oauthError) {
    res.redirect(
      frontendJiraSettingsUrl(
        earlySlug,
        `error=${encodeURIComponent(oauthError)}`
      )
    );
    return;
  }

  const code = String(req.query.code ?? "");
  const payload = earlyPayload;

  if (!code || !payload) {
    res.redirect(frontendJiraSettingsUrl(earlySlug, "error=invalid_state"));
    return;
  }

  const orgSlug = await resolveOrgSlug(
    payload.organizationId,
    payload.organizationSlug
  );

  const redirectUri = atlassianOAuthRedirectUri(publicApiBase(req));

  try {
    const tokens = await exchangeAtlassianCode(code, redirectUri);
    const resources = await fetchAtlassianAccessibleResources(tokens.access_token);
    const site = pickJiraCloudResource(resources);

    if (!site) {
      res.redirect(frontendJiraSettingsUrl(orgSlug, "error=no_jira_site"));
      return;
    }

    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    const scopes = tokens.scope ?? site.scopes.join(" ");

    const creds = await saveOrganizationJiraOAuthConfig(payload.organizationId, {
      baseUrl: site.url,
      email: "pending@oauth",
      cloudId: site.id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? "",
      tokenExpiresAt,
      scopes,
    });

    await savePipelineJiraOAuthCredentialsForOrganization(
      payload.organizationId,
      creds
    );

    let email = "oauth@atlassian";
    try {
      await withOrganizationContext(payload.organizationId, async () => {
        const me = await fetchPipelineJiraCurrentUser();
        email = me.email;
      });
    } catch (err) {
      logger.warn({ err }, "jira oauth: could not fetch profile email");
    }

    const updated = await saveOrganizationJiraOAuthConfig(payload.organizationId, {
      baseUrl: site.url,
      email,
      cloudId: site.id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? "",
      tokenExpiresAt,
      scopes,
      webhookSecret: creds.webhookSecret,
      projectKeys: creds.projectKeys,
    });

    await warmOrganizationJiraCredentials(payload.organizationId);

    try {
      await withOrganizationContext(payload.organizationId, async () => {
        await connectPipelineJira({
          baseUrl: updated.baseUrl,
          email: updated.email,
          organizationId: payload.organizationId,
          webhookUrl: pipelineJiraWebhookUrl(req),
          autoRegisterWebhook: true,
          authMethod: "oauth",
        });
      });
    } catch (err) {
      logger.warn({ err }, "jira oauth: post-connect webhook/sync skipped");
    }

    res.redirect(frontendJiraSettingsUrl(orgSlug, "connected=1"));
  } catch (err) {
    logger.error({ err }, "jira oauth callback failed");
    res.redirect(frontendJiraSettingsUrl(orgSlug, "error=connect_failed"));
  }
});

router.get("/status", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    const jira = await getPublicOrganizationJiraConfig(user.organizationId);
    const oauthAvailable = isAtlassianOAuthEnabled();

    // Warn the frontend when the OAuth app is configured but likely still private
    // (ATLASSIAN_OAUTH_DEV_MODE=true means the app hasn't been published yet).
    const oauthDevMode =
      oauthAvailable &&
      (process.env.ATLASSIAN_OAUTH_DEV_MODE === "true" ||
        process.env.ATLASSIAN_OAUTH_DEV_MODE === "1");

    res.json({
      configured: jira.configured,
      authMethod: jira.authMethod,
      connectedViaOAuth: jira.connectedViaOAuth,
      baseUrl: jira.baseUrl,
      siteName: jira.siteName,
      email: jira.email,
      projectKeys: jira.projectKeys,
      oauthAvailable,
      oauthDevMode,
      callbackUrl: atlassianOAuthRedirectUri(publicApiBase(req)),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/disconnect", async (req, res, next) => {
  try {
    const user = requireOrganizationUser(req, res);
    if (!user?.organizationId) return;

    await clearOrganizationJiraConfig(user.organizationId);
    activateOrganizationJiraContext(null);
    res.json({ disconnected: true });
  } catch (err) {
    next(err);
  }
});

export default router;
