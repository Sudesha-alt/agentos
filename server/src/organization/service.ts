import { prisma } from "../db/client";
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

export interface ProvisionedUserOrg {
  user: { id: string; email: string; name: string };
  organization: { id: string; name: string; domain: string; slug: string };
  role: OrgRole;
  createdOrg: boolean;
}

/** First user from an email domain creates the org; later users auto-join the same team. */
export async function provisionUserAndOrganization(
  email: string
): Promise<ProvisionedUserOrg> {
  const normalizedEmail = email.trim().toLowerCase();
  const domain = extractEmailDomain(normalizedEmail);
  const name = displayNameFromEmail(normalizedEmail);

  const user = await prisma.user.upsert({
    where: { email: normalizedEmail },
    create: { email: normalizedEmail, name },
    update: { name },
  });

  const existingOrg = await prisma.organization.findUnique({
    where: { domain },
    include: {
      members: { where: { userId: user.id }, take: 1 },
    },
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

  const slugBase = domainToSlug(domain);
  let slug = slugBase;
  let suffix = 1;
  while (await prisma.organization.findUnique({ where: { slug } })) {
    slug = `${slugBase}-${suffix}`;
    suffix += 1;
  }

  const organization = await prisma.organization.create({
    data: {
      name: domainToOrgName(domain),
      slug,
      domain,
      members: {
        create: {
          userId: user.id,
          role: "OWNER",
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
