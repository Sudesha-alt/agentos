import type { OrgRole } from "../generated/prisma/client";

let activeOrganizationId: string | null = null;

export function setActiveOrganizationId(organizationId: string | null): void {
  activeOrganizationId = organizationId;
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
