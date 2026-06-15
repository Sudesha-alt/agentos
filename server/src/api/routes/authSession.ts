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

const sessions = new Map<
  string,
  { user: SessionUser; issuedAt: string }
>();

const registeredEmails = new Set<string>(["demo@agentos.ai"]);

export function getSessionsMap() {
  return sessions;
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
  return sessions.get(token)?.user ?? null;
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

  const crypto = await import("crypto");
  const token = crypto.randomBytes(24).toString("hex");
  const issuedAt = new Date().toISOString();
  sessions.set(token, { user: sessionUser, issuedAt });

  const { getOnboarding, ensureOnboarding, seedDemoOnboarding } = await import(
    "../../onboarding/store"
  );

  if (email === "demo@agentos.ai") {
    seedDemoOnboarding(sessionUser.id, sessionUser.email, sessionUser.name);
  } else if (!getOnboarding(sessionUser.id)) {
    ensureOnboarding({
      userId: sessionUser.id,
      email: sessionUser.email,
      name: sessionUser.name,
      completed: false,
    });
  }

  const onboarding = getOnboarding(sessionUser.id);
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
