import { prisma } from "../db/client";
import { isReservedSlug, nameToSlug } from "../shared/reservedSlugs";
import type { OrgRole } from "../generated/prisma/client";

function displayNameFromEmail(email: string): string {
  const localPart = email.split("@")[0] || "operator";
  return (
    localPart
      .split(/[._-]+/)
      .filter(Boolean)
      .map((segment) => segment[0].toUpperCase() + segment.slice(1))
      .join(" ") || "Workspace User"
  );
}

export function extractEmailDomain(email: string): string {
  const domain = email.split("@")[1]?.trim().toLowerCase();
  if (!domain || !domain.includes(".")) {
    throw new Error("invalid_email_domain");
  }
  return domain;
}

function domainToSlug(domain: string): string {
  return domain.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "workspace";
}

function domainToOrgName(domain: string): string {
  const label = domain.split(".")[0] ?? domain;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  if (isReservedSlug(slug)) {
    slug = `${slug}-org`;
  }
  let suffix = 1;
  while (await prisma.organization.findUnique({ where: { slug } })) {
    slug = `${base}-${suffix}`;
    if (isReservedSlug(slug)) {
      slug = `${base}-${suffix}-org`;
    }
    suffix += 1;
  }
  return slug;
}

export interface ProvisionedUserOrg {
  user: { id: string; email: string; name: string };
  organization: { id: string; name: string; domain: string; slug: string };
  role: OrgRole;
  createdOrg: boolean;
}

/** Upsert user record without assigning an organization. */
export async function ensureUser(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const name = displayNameFromEmail(normalizedEmail);
  return prisma.user.upsert({
    where: { email: normalizedEmail },
    create: { email: normalizedEmail, name },
    update: { name },
  });
}

export async function findOrganizationsByDomain(domain: string) {
  const normalizedDomain = domain.trim().toLowerCase();
  const organizations = await prisma.organization.findMany({
    where: { domain: normalizedDomain },
    include: {
      companyProfile: { select: { companyName: true } },
      _count: { select: { members: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return organizations.map((org) => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    domain: org.domain,
    memberCount: org._count.members,
    companyName: org.companyProfile?.companyName || org.name,
  }));
}

export async function createOrganizationForUser(
  userId: string,
  email: string,
  orgName?: string
): Promise<ProvisionedUserOrg> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const domain = extractEmailDomain(email);
  const name = orgName?.trim() || domainToOrgName(domain);
  const slugBase = orgName?.trim() ? nameToSlug(orgName) : domainToSlug(domain);
  const slug = await uniqueSlug(slugBase);

  const organization = await prisma.organization.create({
    data: {
      name,
      slug,
      domain,
      members: {
        create: {
          userId: user.id,
          role: "OWNER",
        },
      },
      billing: {
        create: {
          planId: "pilot",
          runsUsed: 0,
          runsCap: 20,
          billingCycle: "monthly",
        },
      },
    },
  });

  return {
    user,
    organization: {
      id: organization.id,
      name: organization.name,
      domain: organization.domain,
      slug: organization.slug,
    },
    role: "OWNER",
    createdOrg: true,
  };
}

export async function joinOrganizationForUser(
  userId: string,
  email: string,
  organizationId: string
): Promise<ProvisionedUserOrg> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const domain = extractEmailDomain(email);

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
  });
  if (!organization) {
    throw new Error("organization_not_found");
  }
  if (organization.domain !== domain) {
    throw new Error("organization_domain_mismatch");
  }

  const existing = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: { organizationId, userId },
    },
  });

  const membership =
    existing ??
    (await prisma.organizationMember.create({
      data: {
        organizationId,
        userId,
        role: "MEMBER",
      },
    }));

  return {
    user,
    organization: {
      id: organization.id,
      name: organization.name,
      domain: organization.domain,
      slug: organization.slug,
    },
    role: membership.role,
    createdOrg: false,
  };
}

/** @deprecated Auto-joins by domain — use ensureUser + create/join instead. */
export async function provisionUserAndOrganization(
  email: string
): Promise<ProvisionedUserOrg> {
  const user = await ensureUser(email);
  const domain = extractEmailDomain(email);

  const existingOrg = await prisma.organization.findFirst({
    where: { domain },
    include: {
      members: { where: { userId: user.id }, take: 1 },
    },
    orderBy: { createdAt: "asc" },
  });

  if (existingOrg) {
    const membership = existingOrg.members[0]
      ? existingOrg.members[0]
      : await prisma.organizationMember.create({
          data: {
            organizationId: existingOrg.id,
            userId: user.id,
            role: "MEMBER",
          },
        });

    return {
      user,
      organization: {
        id: existingOrg.id,
        name: existingOrg.name,
        domain: existingOrg.domain,
        slug: existingOrg.slug,
      },
      role: membership.role,
      createdOrg: false,
    };
  }

  return createOrganizationForUser(user.id, email);
}

export async function getOrganizationForUser(userId: string) {
  const membership = await prisma.organizationMember.findFirst({
    where: { userId },
    include: { organization: true },
    orderBy: { joinedAt: "asc" },
  });
  if (!membership) return null;
  return {
    organization: membership.organization,
    role: membership.role,
  };
}
