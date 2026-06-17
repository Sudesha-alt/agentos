import crypto from "crypto";
import type { OrgRole } from "../../generated/prisma/client";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  organizationId?: string;
  organizationName?: string;
  organizationDomain?: string;
  organizationSlug?: string;
  organizationRole?: OrgRole;
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
    organizationSlug: payload.organizationSlug,
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

function sessionUserFromMembership(
  user: { id: string; email: string; name: string },
  membership: {
    organization: { id: string; name: string; domain: string; slug: string };
    role: OrgRole;
  } | null
): SessionUser {
  if (!membership) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
    };
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    organizationId: membership.organization.id,
    organizationName: membership.organization.name,
    organizationDomain: membership.organization.domain,
    organizationSlug: membership.organization.slug,
    organizationRole: membership.role,
  };
}

export async function issueSessionForUserId(userId: string) {
  const { prisma } = await import("../../db/client");
  const { getOrganizationForUser } = await import("../../organization/service");

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const membership = await getOrganizationForUser(user.id);
  const sessionUser = sessionUserFromMembership(user, membership);

  const issuedAt = new Date().toISOString();
  const token = signAuthToken({ ...sessionUser, issuedAt });

  const { getOnboarding } = await import("../../onboarding/store");
  const onboarding = await getOnboarding(sessionUser.id);

  if (membership) {
    const { warmOrganizationJiraCredentials, activateOrganizationJiraContext } =
      await import("../../pipeline/jira/credentialsStore");
    const { setActiveOrganizationId } = await import("../../organization/context");
    setActiveOrganizationId(membership.organization.id);
    await warmOrganizationJiraCredentials(membership.organization.id);
    activateOrganizationJiraContext(membership.organization.id);
  }

  return {
    token,
    issuedAt,
    user: sessionUser,
    organization: membership
      ? {
          id: membership.organization.id,
          name: membership.organization.name,
          domain: membership.organization.domain,
          slug: membership.organization.slug,
          role: membership.role,
        }
      : undefined,
    onboardingCompleted: onboarding?.completed ?? false,
  };
}

export async function createAuthSession(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const { ensureUser, provisionUserAndOrganization } = await import(
    "../../organization/service"
  );

  if (normalizedEmail === "demo@agentos.ai") {
    await provisionUserAndOrganization(normalizedEmail);
  } else {
    await ensureUser(normalizedEmail);
  }

  const { prisma } = await import("../../db/client");
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: normalizedEmail },
  });

  const { ensureOnboarding, seedDemoOnboarding } = await import("../../onboarding/store");

  if (normalizedEmail === "demo@agentos.ai") {
    const session = await issueSessionForUserId(user.id);
    await seedDemoOnboarding(session.user.id, session.user.email, session.user.name);
    return {
      ...session,
      onboardingCompleted: true,
    };
  }

  await ensureOnboarding({
    userId: user.id,
    email: user.email,
    name: user.name,
    completed: false,
  });

  return issueSessionForUserId(user.id);
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
