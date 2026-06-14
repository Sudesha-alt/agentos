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

const records = new Map<string, UserOnboardingRecord>();

export function getOnboarding(userId: string): UserOnboardingRecord | null {
  return records.get(userId) ?? null;
}

export function ensureOnboarding(input: {
  userId: string;
  email: string;
  name: string;
  completed?: boolean;
}): UserOnboardingRecord {
  const existing = records.get(input.userId);
  if (existing) return existing;

  const now = new Date().toISOString();
  const record: UserOnboardingRecord = {
    userId: input.userId,
    email: input.email,
    name: input.name,
    companyStage: null,
    teamSize: null,
    role: null,
    completed: input.completed ?? false,
    completedAt: input.completed ? now : null,
    updatedAt: now,
  };
  records.set(input.userId, record);
  return record;
}

export function updateOnboarding(
  userId: string,
  patch: Partial<
    Pick<UserOnboardingRecord, "name" | "companyStage" | "teamSize" | "role">
  >
): UserOnboardingRecord {
  const record = records.get(userId);
  if (!record) {
    throw new Error("onboarding_not_found");
  }
  const updated: UserOnboardingRecord = {
    ...record,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  records.set(userId, updated);
  return updated;
}

export function completeOnboarding(userId: string): UserOnboardingRecord {
  const record = records.get(userId);
  if (!record) throw new Error("onboarding_not_found");
  const now = new Date().toISOString();
  const updated: UserOnboardingRecord = {
    ...record,
    completed: true,
    completedAt: now,
    updatedAt: now,
  };
  records.set(userId, updated);
  return updated;
}

/** Demo workspace user — skip onboarding. */
export function seedDemoOnboarding(userId: string, email: string, name: string) {
  ensureOnboarding({ userId, email, name, completed: true });
}
