import { prisma } from "../db/client";

export type CompanyStage =
  | "idea"
  | "mvp"
  | "growth"
  | "scale"
  | "enterprise";

export type TeamSize = "solo" | "2-10" | "11-50" | "51-200" | "200+";

export type UserRole =
  | "founder"
  | "product"
  | "engineering"
  | "engineering_lead"
  | "ops"
  | "other";

export interface UserOnboardingRecord {
  userId: string;
  email: string;
  name: string;
  companyStage: CompanyStage | null;
  teamSize: TeamSize | null;
  role: UserRole | null;
  completed: boolean;
  completedAt: string | null;
  updatedAt: string;
}

function rowToRecord(
  row: {
    userId: string;
    name: string;
    companyStage: string | null;
    teamSize: string | null;
    role: string | null;
    completed: boolean;
    completedAt: Date | null;
    updatedAt: Date;
  },
  email: string
): UserOnboardingRecord {
  return {
    userId: row.userId,
    email,
    name: row.name,
    companyStage: (row.companyStage as CompanyStage | null) ?? null,
    teamSize: (row.teamSize as TeamSize | null) ?? null,
    role: (row.role as UserRole | null) ?? null,
    completed: row.completed,
    completedAt: row.completedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getOnboarding(
  userId: string
): Promise<UserOnboardingRecord | null> {
  const row = await prisma.userOnboarding.findUnique({
    where: { userId },
    include: { user: { select: { email: true } } },
  });
  if (!row) return null;
  return rowToRecord(row, row.user.email);
}

export async function ensureOnboarding(input: {
  userId: string;
  email: string;
  name: string;
  completed?: boolean;
}): Promise<UserOnboardingRecord> {
  const existing = await prisma.userOnboarding.findUnique({
    where: { userId: input.userId },
    include: { user: { select: { email: true } } },
  });
  if (existing) {
    return rowToRecord(existing, existing.user.email);
  }

  const completed = input.completed ?? false;
  const row = await prisma.userOnboarding.create({
    data: {
      userId: input.userId,
      name: input.name,
      completed,
      completedAt: completed ? new Date() : null,
    },
    include: { user: { select: { email: true } } },
  });
  return rowToRecord(row, row.user.email);
}

export async function updateOnboarding(
  userId: string,
  patch: Partial<
    Pick<UserOnboardingRecord, "name" | "companyStage" | "teamSize" | "role">
  >
): Promise<UserOnboardingRecord> {
  const existing = await prisma.userOnboarding.findUnique({
    where: { userId },
    include: { user: { select: { email: true } } },
  });
  if (!existing) {
    throw new Error("onboarding_not_found");
  }

  const row = await prisma.userOnboarding.update({
    where: { userId },
    data: {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.companyStage !== undefined
        ? { companyStage: patch.companyStage }
        : {}),
      ...(patch.teamSize !== undefined ? { teamSize: patch.teamSize } : {}),
      ...(patch.role !== undefined ? { role: patch.role } : {}),
    },
    include: { user: { select: { email: true } } },
  });
  return rowToRecord(row, row.user.email);
}

export async function completeOnboarding(
  userId: string
): Promise<UserOnboardingRecord> {
  const existing = await prisma.userOnboarding.findUnique({
    where: { userId },
    include: { user: { select: { email: true } } },
  });
  if (!existing) throw new Error("onboarding_not_found");

  const row = await prisma.userOnboarding.update({
    where: { userId },
    data: {
      completed: true,
      completedAt: new Date(),
    },
    include: { user: { select: { email: true } } },
  });
  return rowToRecord(row, row.user.email);
}

/** Demo workspace user — skip onboarding. */
export async function seedDemoOnboarding(
  userId: string,
  email: string,
  name: string
) {
  await ensureOnboarding({ userId, email, name, completed: true });
}
