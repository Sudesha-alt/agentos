import { prisma } from "../db/client";
import { requireActiveOrganizationId } from "../organization/orgScope";
import type { JiraSyncMode, JiraSyncStatus } from "../db/prisma";

let syncRunning = false;
const orgSyncRunning = new Set<string>();

export function isJiraSyncRunning(organizationId?: string): boolean {
  if (organizationId) return orgSyncRunning.has(organizationId);
  return syncRunning || orgSyncRunning.size > 0;
}

export function setJiraSyncRunning(running: boolean, organizationId?: string): void {
  if (organizationId) {
    if (running) orgSyncRunning.add(organizationId);
    else orgSyncRunning.delete(organizationId);
    return;
  }
  syncRunning = running;
}

export async function createSyncRun(mode: JiraSyncMode, organizationId?: string) {
  const orgId = organizationId ?? requireActiveOrganizationId();
  return prisma.jiraSyncRun.create({
    data: {
      organizationId: orgId,
      mode,
      status: "RUNNING",
    },
  });
}

export async function completeSyncRun(
  id: string,
  result: {
    status: JiraSyncStatus;
    issuesSynced: number;
    issuesSkipped: number;
    errors: number;
    errorMessage?: string;
    watermark?: Date;
  }
) {
  return prisma.jiraSyncRun.update({
    where: { id },
    data: {
      status: result.status,
      completedAt: new Date(),
      issuesSynced: result.issuesSynced,
      issuesSkipped: result.issuesSkipped,
      errors: result.errors,
      errorMessage: result.errorMessage ?? null,
      watermark: result.watermark ?? null,
    },
  });
}

export async function getLatestSyncRun(organizationId?: string) {
  const orgId = organizationId ?? requireActiveOrganizationId();
  return prisma.jiraSyncRun.findFirst({
    where: { organizationId: orgId },
    orderBy: { startedAt: "desc" },
  });
}

export async function getLastSuccessfulWatermark(organizationId?: string): Promise<Date | null> {
  const orgId = organizationId ?? requireActiveOrganizationId();
  const run = await prisma.jiraSyncRun.findFirst({
    where: { organizationId: orgId, status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
  });
  return run?.watermark ?? run?.completedAt ?? null;
}
