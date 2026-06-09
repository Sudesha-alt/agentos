import { prisma } from "../db/client";
import type { JiraSyncMode, JiraSyncStatus } from "../db/prisma";

let syncRunning = false;

export function isJiraSyncRunning(): boolean {
  return syncRunning;
}

export function setJiraSyncRunning(running: boolean): void {
  syncRunning = running;
}

export async function createSyncRun(mode: JiraSyncMode) {
  return prisma.jiraSyncRun.create({
    data: {
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

export async function getLatestSyncRun() {
  return prisma.jiraSyncRun.findFirst({
    orderBy: { startedAt: "desc" },
  });
}

export async function getLastSuccessfulWatermark(): Promise<Date | null> {
  const run = await prisma.jiraSyncRun.findFirst({
    where: { status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
  });
  return run?.watermark ?? run?.completedAt ?? null;
}
