import crypto from "crypto";
import type { OrgRole } from "../../generated/prisma/client";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  organizationId: string;
  organizationName: string;
  organizationDomain: string;
  organizationRole: OrgRole;
};

type AuthTokenPayload = SessionUser & {
  issuedAt: string;
};

const registeredEmails = new Set<string>(["demo@agentos.ai"]);

function authSecret(): string {
  return (
    process.env.AUTH_JWT_SECRET?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    "agentos-dev-auth-secret-change-in-production"
  );
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signAuthToken(payload: AuthTokenPayload): string {
  const body = encodeBase64Url(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", authSecret())
    .update(body)
    .digest("base64url");
  return `${body}.${signature}`;
}

function verifyAuthToken(token: string): AuthTokenPayload | null {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = crypto
    .createHmac("sha256", authSecret())
    .update(body)
    .digest("base64url");
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    sigBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    return JSON.parse(decodeBase64Url(body)) as AuthTokenPayload;
  } catch {
    return null;
  }
}

/** @deprecated JWT auth no longer uses an in-memory session map. */
export function getSessionsMap() {
  return new Map<string, { user: SessionUser; issuedAt: string }>();
}

export function getRegisteredEmails() {
  return registeredEmails;
}

export function extractAuthToken(req: {
  header: (name: string) => string | undefined;
  query: { token?: string };
}): string | undefined {
  const header = req.header("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) {
    return header.slice(7).trim();
  }
  if (typeof req.query.token === "string") {
    return req.query.token;
  }
  return undefined;
}

export function resolveUserFromAuthHeader(req: {
  header: (name: string) => string | undefined;
  query: { token?: string };
}): SessionUser | null {
  const token = extractAuthToken(req);
  if (!token) return null;
  const payload = verifyAuthToken(token);
  if (!payload) return null;

  return {
    id: payload.id,
    email: payload.email,
    name: payload.name,
    organizationId: payload.organizationId,
    organizationName: payload.organizationName,
    organizationDomain: payload.organizationDomain,
    organizationRole: payload.organizationRole,
  };
}

export function displayNameFromEmail(email: string): string {
  const localPart = email.split("@")[0] || "operator";
  return (
    localPart
      .split(/[._-]+/)
      .filter(Boolean)
      .map((segment) => segment[0].toUpperCase() + segment.slice(1))
      .join(" ") || "Workspace User"
  );
}

export async function createAuthSession(email: string) {
  const { provisionUserAndOrganization } = await import("../../organization/service");
  const { user, organization, role } = await provisionUserAndOrganization(email);

  const sessionUser: SessionUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    organizationId: organization.id,
    organizationName: organization.name,
    organizationDomain: organization.domain,
    organizationRole: role,
  };

  const issuedAt = new Date().toISOString();
  const token = signAuthToken({ ...sessionUser, issuedAt });

  const { ensureOnboarding, seedDemoOnboarding } = await import("../../onboarding/store");

  if (email === "demo@agentos.ai") {
    await seedDemoOnboarding(sessionUser.id, sessionUser.email, sessionUser.name);
  } else {
    await ensureOnboarding({
      userId: sessionUser.id,
      email: sessionUser.email,
      name: sessionUser.name,
      completed: false,
    });
  }

  const { getOnboarding } = await import("../../onboarding/store");
  const onboarding = await getOnboarding(sessionUser.id);
  const { warmOrganizationJiraCredentials, activateOrganizationJiraContext } =
    await import("../../pipeline/jira/credentialsStore");
  const { setActiveOrganizationId } = await import("../../organization/context");
  setActiveOrganizationId(organization.id);
  await warmOrganizationJiraCredentials(organization.id);
  activateOrganizationJiraContext(organization.id);

  return {
    token,
    issuedAt,
    user: sessionUser,
    organization: {
      id: organization.id,
      name: organization.name,
      domain: organization.domain,
      slug: organization.slug,
      role,
    },
    onboardingCompleted: onboarding?.completed ?? false,
  };
}

export function registerEmail(email: string) {
  registeredEmails.add(email);
}

export function isEmailRegistered(email: string) {
  return registeredEmails.has(email);
}

export function revokeAuthToken(_token: string): void {
  // JWT sessions are stateless; client discard is sufficient for now.
}
