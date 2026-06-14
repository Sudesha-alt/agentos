import { prisma } from "../db/client";

export type WorkspacePlanId = "pilot" | "starter" | "growth" | "enterprise";

export interface WorkspaceBillingDto {
  planId: WorkspacePlanId;
  runsUsed: number;
  runsCap: number;
  pilotEndsAt: string | null;
  billingCycle: string;
}

const DEFAULT: WorkspaceBillingDto = {
  planId: "pilot",
  runsUsed: 0,
  runsCap: 20,
  pilotEndsAt: null,
  billingCycle: "monthly",
};

function toDto(row: {
  planId: string;
  runsUsed: number;
  runsCap: number;
  pilotEndsAt: Date | null;
  billingCycle: string;
}): WorkspaceBillingDto {
  return {
    planId: row.planId as WorkspacePlanId,
    runsUsed: row.runsUsed,
    runsCap: row.runsCap,
    pilotEndsAt: row.pilotEndsAt?.toISOString() ?? null,
    billingCycle: row.billingCycle,
  };
}

export const workspaceBillingStore = {
  async get(): Promise<WorkspaceBillingDto> {
    const row = await prisma.workspaceBilling.findUnique({ where: { id: "default" } });
    if (!row) return { ...DEFAULT };
    return toDto(row);
  },

  async save(patch: Partial<WorkspaceBillingDto>): Promise<WorkspaceBillingDto> {
    const row = await prisma.workspaceBilling.upsert({
      where: { id: "default" },
      create: {
        id: "default",
        planId: patch.planId ?? DEFAULT.planId,
        runsUsed: patch.runsUsed ?? DEFAULT.runsUsed,
        runsCap: patch.runsCap ?? DEFAULT.runsCap,
        pilotEndsAt: patch.pilotEndsAt ? new Date(patch.pilotEndsAt) : null,
        billingCycle: patch.billingCycle ?? DEFAULT.billingCycle,
      },
      update: {
        ...(patch.planId !== undefined ? { planId: patch.planId } : {}),
        ...(patch.runsUsed !== undefined ? { runsUsed: patch.runsUsed } : {}),
        ...(patch.runsCap !== undefined ? { runsCap: patch.runsCap } : {}),
        ...(patch.pilotEndsAt !== undefined
          ? { pilotEndsAt: patch.pilotEndsAt ? new Date(patch.pilotEndsAt) : null }
          : {}),
        ...(patch.billingCycle !== undefined ? { billingCycle: patch.billingCycle } : {}),
      },
    });
    return toDto(row);
  },
};
