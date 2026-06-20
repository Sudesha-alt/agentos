import type { OrgRole } from "../generated/prisma/client";

let activeOrganizationId: string | null = null;
let organizationContextDepth = 0;

export function enterActiveOrganizationContext(organizationId: string): void {
  activeOrganizationId = organizationId;
  organizationContextDepth += 1;
}

export function leaveActiveOrganizationContext(): void {
  organizationContextDepth = Math.max(0, organizationContextDepth - 1);
  if (organizationContextDepth === 0) {
    activeOrganizationId = null;
  }
}

export function isOrganizationContextActive(): boolean {
  return organizationContextDepth > 0 && Boolean(activeOrganizationId);
}

/** Direct assignment — used by legacy routes; resets nested depth tracking. */
export function setActiveOrganizationId(organizationId: string | null): void {
  activeOrganizationId = organizationId;
  organizationContextDepth = organizationId ? 1 : 0;
}

export function getActiveOrganizationId(): string | null {
  return activeOrganizationId;
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
