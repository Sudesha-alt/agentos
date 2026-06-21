import type { Request, Response, NextFunction } from "express";
import {
  activateOrganizationJiraContext,
  warmOrganizationJiraCredentials,
} from "../pipeline/jira/credentialsStore";
import {
  activateOrganizationGitContext,
  warmOrganizationGitCredentials,
} from "../git-integration/gitCredentialsStore";
import { runInOrganizationContextAsync } from "../organization/context";
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
  return runInOrganizationContextAsync(organizationId, async () => {
    await warmOrganizationJiraCredentials(organizationId);
    await warmOrganizationGitCredentials(organizationId);
    const { warmOrganizationIntakeMapping } = await import("../pipeline/jira/intakeConfig");
    await warmOrganizationIntakeMapping(organizationId);
    activateOrganizationJiraContext(organizationId);
    activateOrganizationGitContext(organizationId);
    try {
      return await fn();
    } finally {
      activateOrganizationJiraContext(null);
      activateOrganizationGitContext(null);
    }
  });
}

/**
 * Express middleware: bind org credentials + AsyncLocalStorage for the full request
 * (until response finishes). Does not clear global org id — avoids breaking background jobs.
 */
export function bindOrganizationContextMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const user = requireOrganizationUser(req, res);
  if (!user?.organizationId) return;

  void runInOrganizationContextAsync(user.organizationId, async () => {
    await warmOrganizationJiraCredentials(user.organizationId!);
    await warmOrganizationGitCredentials(user.organizationId!);
    const { warmOrganizationIntakeMapping } = await import("../pipeline/jira/intakeConfig");
    await warmOrganizationIntakeMapping(user.organizationId!);
    activateOrganizationJiraContext(user.organizationId!);
    activateOrganizationGitContext(user.organizationId!);

    await new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        activateOrganizationJiraContext(null);
        activateOrganizationGitContext(null);
        resolve();
      };
      res.once("finish", done);
      res.once("close", done);
      next();
    });
  }).catch(next);
}
