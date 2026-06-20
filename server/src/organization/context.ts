import { AsyncLocalStorage } from "node:async_hooks";
import type { OrgRole } from "../generated/prisma/client";

/** Per-async-chain org scope — survives concurrent requests and background index jobs. */
const organizationContextStorage = new AsyncLocalStorage<string>();

/** Legacy fallback for routes not yet on AsyncLocalStorage. */
let legacyActiveOrganizationId: string | null = null;

export function runInOrganizationContext<T>(organizationId: string, fn: () => T): T {
  return organizationContextStorage.run(organizationId, fn);
}

export function runInOrganizationContextAsync<T>(
  organizationId: string,
  fn: () => Promise<T>
): Promise<T> {
  return organizationContextStorage.run(organizationId, fn);
}

export function setActiveOrganizationId(organizationId: string | null): void {
  legacyActiveOrganizationId = organizationId;
}

export function getActiveOrganizationId(): string | null {
  return organizationContextStorage.getStore() ?? legacyActiveOrganizationId;
}

export type OrganizationContext = {
  organizationId: string;
  organizationName: string;
  organizationDomain: string;
  organizationRole: OrgRole;
};

export function organizationContextFromUser(user: {
  organizationId: string;
  organizationName: string;
  organizationDomain: string;
  organizationRole: OrgRole;
}): OrganizationContext {
  return {
    organizationId: user.organizationId,
    organizationName: user.organizationName,
    organizationDomain: user.organizationDomain,
    organizationRole: user.organizationRole,
  };
}
