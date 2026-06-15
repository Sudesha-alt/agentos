import { getActiveOrganizationId } from "./context";

export function requireActiveOrganizationId(): string {
  const organizationId = getActiveOrganizationId();
  if (!organizationId) {
    throw new Error("organization_context_required");
  }
  return organizationId;
}

export function activeOrganizationFilter(): { organizationId: string } {
  return { organizationId: requireActiveOrganizationId() };
}

export function organizationIdOrNull(): string | null {
  return getActiveOrganizationId();
}
