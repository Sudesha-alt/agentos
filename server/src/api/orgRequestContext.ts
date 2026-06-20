import type { Request, Response } from "express";
import {
  activateOrganizationJiraContext,
  warmOrganizationJiraCredentials,
} from "../pipeline/jira/credentialsStore";
import {
  activateOrganizationGitContext,
  warmOrganizationGitCredentials,
} from "../git-integration/gitCredentialsStore";
import {
  enterActiveOrganizationContext,
  leaveActiveOrganizationContext,
  isOrganizationContextActive,
} from "../organization/context";
import { resolveUserFromAuthHeader, type SessionUser } from "./routes/authSession";

export function requireAuthUser(
  req: Request,
  res: Response
): SessionUser | null {
  const user = resolveUserFromAuthHeader(req);
  if (!user) {
    res.status(401).json({ error: "unauthorized" });
    return null;
  }
  return user;
}

export function requireOrganizationUser(
  req: Request,
  res: Response
): SessionUser | null {
  const user = requireAuthUser(req, res);
  if (!user) return null;
  if (!user.organizationId) {
    res.status(403).json({ error: "organization_required" });
    return null;
  }
  return user;
}

export async function withOrganizationContext<T>(
  organizationId: string,
  fn: () => Promise<T>
): Promise<T> {
  enterActiveOrganizationContext(organizationId);
  await warmOrganizationJiraCredentials(organizationId);
  await warmOrganizationGitCredentials(organizationId);
  const { warmOrganizationIntakeMapping } = await import("../pipeline/jira/intakeConfig");
  await warmOrganizationIntakeMapping(organizationId);
  activateOrganizationJiraContext(organizationId);
  activateOrganizationGitContext(organizationId);
  try {
    return await fn();
  } finally {
    leaveActiveOrganizationContext();
    if (!isOrganizationContextActive()) {
      activateOrganizationJiraContext(null);
      activateOrganizationGitContext(null);
    }
  }
}
