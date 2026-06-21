import { prisma } from "../db/client";
import { requireActiveOrganizationId } from "../organization/orgScope";

export type QueueItemStatus = "PENDING" | "ACTIVE" | "COMPLETED" | "FAILED";

export interface PipelineQueueRow {
  id: string;
  ticket_id: string;
  jira_key: string;
  organization_id: string;
  position: number;
  status: QueueItemStatus;
  enqueued_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface QueueItem {
  id: string;
  ticketId: string;
  jiraKey: string;
  organizationId: string;
}

function rowToItem(row: PipelineQueueRow): QueueItem {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    jiraKey: row.jira_key,
    organizationId: row.organization_id,
  };
}

function mapRow(item: {
  id: string;
  ticketId: string;
  jiraKey: string;
  organizationId: string;
  position: number;
  status: QueueItemStatus;
  enqueuedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}): PipelineQueueRow {
  return {
    id: item.id,
    ticket_id: item.ticketId,
    jira_key: item.jiraKey,
    organization_id: item.organizationId,
    position: item.position,
    status: item.status,
    enqueued_at: item.enqueuedAt.toISOString(),
    started_at: item.startedAt?.toISOString() ?? null,
    completed_at: item.completedAt?.toISOString() ?? null,
  };
}

function resolveOrgId(organizationId?: string): string {
  return organizationId ?? requireActiveOrganizationId();
}

export async function enqueueQueueItem(
  ticketId: string,
  jiraKey: string,
  organizationId?: string
): Promise<QueueItem | null> {
  const orgId = resolveOrgId(organizationId);
  const existing = await prisma.pipelineQueueItem.findFirst({
    where: {
      organizationId: orgId,
      OR: [{ ticketId }, { jiraKey }],
      status: { in: ["PENDING", "ACTIVE"] },
    },
    select: { id: true },
  });
  if (existing) return null;

  const maxPos = await prisma.pipelineQueueItem.aggregate({
    where: { organizationId: orgId, status: "PENDING" },
    _max: { position: true },
  });
  const position = (maxPos._max.position ?? 0) + 1;

  const created = await prisma.pipelineQueueItem.create({
    data: {
      organizationId: orgId,
      ticketId,
      jiraKey,
      position,
      status: "PENDING",
    },
  });

  return {
    id: created.id,
    ticketId,
    jiraKey,
    organizationId: orgId,
  };
}

export async function markQueueItemActive(id: string): Promise<void> {
  await prisma.pipelineQueueItem.update({
    where: { id },
    data: { status: "ACTIVE", startedAt: new Date() },
  });
}

export async function markQueueItemCompleted(
  id: string,
  status: "COMPLETED" | "FAILED" = "COMPLETED"
): Promise<void> {
  await prisma.pipelineQueueItem.update({
    where: { id },
    data: { status, completedAt: new Date() },
  });
}

export async function getActiveQueueItem(
  organizationId?: string
): Promise<QueueItem | null> {
  const row = await prisma.pipelineQueueItem.findFirst({
    where: {
      ...(organizationId ? { organizationId } : {}),
      status: "ACTIVE",
    },
    orderBy: { startedAt: "asc" },
  });
  return row
    ? {
        id: row.id,
        ticketId: row.ticketId,
        jiraKey: row.jiraKey,
        organizationId: row.organizationId,
      }
    : null;
}

export async function listPendingQueueItems(
  organizationId?: string
): Promise<QueueItem[]> {
  const orgId = resolveOrgId(organizationId);
  const rows = await prisma.pipelineQueueItem.findMany({
    where: { organizationId: orgId, status: "PENDING" },
    orderBy: { position: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    ticketId: row.ticketId,
    jiraKey: row.jiraKey,
    organizationId: row.organizationId,
  }));
}

export async function dequeueNextPending(
  organizationId?: string
): Promise<QueueItem | null> {
  const row = await prisma.pipelineQueueItem.findFirst({
    where: {
      ...(organizationId ? { organizationId } : {}),
      status: "PENDING",
    },
    orderBy: { position: "asc" },
  });
  return row
    ? {
        id: row.id,
        ticketId: row.ticketId,
        jiraKey: row.jiraKey,
        organizationId: row.organizationId,
      }
    : null;
}

export async function isTicketOrKeyQueued(
  ticketId: string,
  jiraKey: string,
  organizationId?: string
): Promise<boolean> {
  const orgId = resolveOrgId(organizationId);
  const row = await prisma.pipelineQueueItem.findFirst({
    where: {
      organizationId: orgId,
      OR: [{ ticketId }, { jiraKey }],
      status: { in: ["PENDING", "ACTIVE"] },
    },
    select: { id: true },
  });
  return Boolean(row);
}

export async function isJiraKeyInDbQueue(
  jiraKey: string,
  organizationId?: string
): Promise<boolean> {
  const orgId = resolveOrgId(organizationId);
  const row = await prisma.pipelineQueueItem.findFirst({
    where: {
      organizationId: orgId,
      jiraKey,
      status: { in: ["PENDING", "ACTIVE"] },
    },
    select: { id: true },
  });
  return Boolean(row);
}

export async function resetStaleActiveItems(): Promise<number> {
  const result = await prisma.pipelineQueueItem.updateMany({
    where: { status: "ACTIVE" },
    data: { status: "PENDING", startedAt: null },
  });
  return result.count;
}

export async function listOrganizationIdsWithPendingQueue(): Promise<string[]> {
  const rows = await prisma.pipelineQueueItem.findMany({
    where: { status: { in: ["PENDING", "ACTIVE"] } },
    select: { organizationId: true },
    distinct: ["organizationId"],
  });
  return rows.map((r) => r.organizationId);
}

export async function getQueueStats(organizationId?: string): Promise<{
  pending: number;
  active: number;
  completed: number;
}> {
  if (organizationId) {
    const orgId = resolveOrgId(organizationId);
    const [pending, active, completed] = await Promise.all([
      prisma.pipelineQueueItem.count({
        where: { organizationId: orgId, status: "PENDING" },
      }),
      prisma.pipelineQueueItem.count({
        where: { organizationId: orgId, status: "ACTIVE" },
      }),
      prisma.pipelineQueueItem.count({
        where: { organizationId: orgId, status: "COMPLETED" },
      }),
    ]);
    return { pending, active, completed };
  }

  const [pending, active, completed] = await Promise.all([
    prisma.pipelineQueueItem.count({ where: { status: "PENDING" } }),
    prisma.pipelineQueueItem.count({ where: { status: "ACTIVE" } }),
    prisma.pipelineQueueItem.count({ where: { status: "COMPLETED" } }),
  ]);
  return { pending, active, completed };
}

export async function listQueueItems(
  organizationId?: string,
  limit = 50
): Promise<PipelineQueueRow[]> {
  const orgId = resolveOrgId(organizationId);
  const rows = await prisma.pipelineQueueItem.findMany({
    where: {
      organizationId: orgId,
      status: { in: ["PENDING", "ACTIVE"] },
    },
    orderBy: [{ status: "asc" }, { position: "asc" }],
    take: limit,
  });
  return rows.map(mapRow);
}
