import { getDb } from "../jira-intake/sqliteStore";
import { requireActiveOrganizationId } from "../organization/orgScope";

export type QueueItemStatus = "PENDING" | "ACTIVE" | "COMPLETED" | "FAILED";

export interface PipelineQueueRow {
  id: number;
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
  id: number;
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

function resolveOrgId(organizationId?: string): string {
  return organizationId ?? requireActiveOrganizationId();
}

export function enqueueQueueItem(
  ticketId: string,
  jiraKey: string,
  organizationId?: string
): QueueItem | null {
  const orgId = resolveOrgId(organizationId);
  const db = getDb();
  const existing = db
    .prepare(
      `SELECT id FROM pipeline_queue_items
       WHERE organization_id = ? AND (ticket_id = ? OR jira_key = ?) AND status IN ('PENDING', 'ACTIVE')`
    )
    .get(orgId, ticketId, jiraKey) as { id: number } | undefined;
  if (existing) return null;

  const maxPos = db
    .prepare(
      `SELECT COALESCE(MAX(position), 0) AS m FROM pipeline_queue_items WHERE organization_id = ? AND status = 'PENDING'`
    )
    .get(orgId) as { m: number };
  const position = maxPos.m + 1;
  const now = new Date().toISOString();

  const result = db
    .prepare(
      `INSERT INTO pipeline_queue_items (ticket_id, jira_key, organization_id, position, status, enqueued_at)
       VALUES (?, ?, ?, ?, 'PENDING', ?)`
    )
    .run(ticketId, jiraKey, orgId, position, now);

  return {
    id: Number(result.lastInsertRowid),
    ticketId,
    jiraKey,
    organizationId: orgId,
  };
}

export function markQueueItemActive(id: number): void {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `UPDATE pipeline_queue_items SET status = 'ACTIVE', started_at = ? WHERE id = ?`
    )
    .run(now, id);
}

export function markQueueItemCompleted(id: number, status: "COMPLETED" | "FAILED" = "COMPLETED"): void {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `UPDATE pipeline_queue_items SET status = ?, completed_at = ? WHERE id = ?`
    )
    .run(status, now, id);
}

export function getActiveQueueItem(organizationId?: string): QueueItem | null {
  const orgId = organizationId ? resolveOrgId(organizationId) : undefined;
  const row = orgId
    ? (getDb()
        .prepare(
          `SELECT * FROM pipeline_queue_items WHERE organization_id = ? AND status = 'ACTIVE' ORDER BY started_at ASC LIMIT 1`
        )
        .get(orgId) as PipelineQueueRow | undefined)
    : (getDb()
        .prepare(
          `SELECT * FROM pipeline_queue_items WHERE status = 'ACTIVE' ORDER BY started_at ASC LIMIT 1`
        )
        .get() as PipelineQueueRow | undefined);
  return row ? rowToItem(row) : null;
}

export function listPendingQueueItems(organizationId?: string): QueueItem[] {
  const orgId = resolveOrgId(organizationId);
  const rows = getDb()
    .prepare(
      `SELECT * FROM pipeline_queue_items WHERE organization_id = ? AND status = 'PENDING' ORDER BY position ASC`
    )
    .all(orgId) as PipelineQueueRow[];
  return rows.map(rowToItem);
}

export function dequeueNextPending(organizationId?: string): QueueItem | null {
  const orgId = organizationId ? resolveOrgId(organizationId) : undefined;
  const row = orgId
    ? (getDb()
        .prepare(
          `SELECT * FROM pipeline_queue_items WHERE organization_id = ? AND status = 'PENDING' ORDER BY position ASC LIMIT 1`
        )
        .get(orgId) as PipelineQueueRow | undefined)
    : (getDb()
        .prepare(
          `SELECT * FROM pipeline_queue_items WHERE status = 'PENDING' ORDER BY position ASC LIMIT 1`
        )
        .get() as PipelineQueueRow | undefined);
  return row ? rowToItem(row) : null;
}

export function isTicketOrKeyQueued(
  ticketId: string,
  jiraKey: string,
  organizationId?: string
): boolean {
  const orgId = resolveOrgId(organizationId);
  const row = getDb()
    .prepare(
      `SELECT 1 FROM pipeline_queue_items
       WHERE organization_id = ? AND (ticket_id = ? OR jira_key = ?) AND status IN ('PENDING', 'ACTIVE')`
    )
    .get(orgId, ticketId, jiraKey);
  return Boolean(row);
}

export function isJiraKeyInDbQueue(jiraKey: string, organizationId?: string): boolean {
  const orgId = resolveOrgId(organizationId);
  const row = getDb()
    .prepare(
      `SELECT 1 FROM pipeline_queue_items WHERE organization_id = ? AND jira_key = ? AND status IN ('PENDING', 'ACTIVE')`
    )
    .get(orgId, jiraKey);
  return Boolean(row);
}

export function resetStaleActiveItems(): number {
  const result = getDb()
    .prepare(
      `UPDATE pipeline_queue_items SET status = 'PENDING', started_at = NULL
       WHERE status = 'ACTIVE'`
    )
    .run();
  return result.changes;
}

export function getQueueStats(organizationId?: string): {
  pending: number;
  active: number;
  completed: number;
} {
  const db = getDb();
  if (organizationId) {
    const orgId = resolveOrgId(organizationId);
    const pending =
      (db.prepare(`SELECT COUNT(*) AS c FROM pipeline_queue_items WHERE organization_id = ? AND status = 'PENDING'`).get(orgId) as { c: number }).c;
    const active =
      (db.prepare(`SELECT COUNT(*) AS c FROM pipeline_queue_items WHERE organization_id = ? AND status = 'ACTIVE'`).get(orgId) as { c: number }).c;
    const completed =
      (db.prepare(`SELECT COUNT(*) AS c FROM pipeline_queue_items WHERE organization_id = ? AND status = 'COMPLETED'`).get(orgId) as { c: number }).c;
    return { pending, active, completed };
  }
  const pending =
    (db.prepare(`SELECT COUNT(*) AS c FROM pipeline_queue_items WHERE status = 'PENDING'`).get() as { c: number }).c;
  const active =
    (db.prepare(`SELECT COUNT(*) AS c FROM pipeline_queue_items WHERE status = 'ACTIVE'`).get() as { c: number }).c;
  const completed =
    (db.prepare(`SELECT COUNT(*) AS c FROM pipeline_queue_items WHERE status = 'COMPLETED'`).get() as { c: number }).c;
  return { pending, active, completed };
}

export function listQueueItems(organizationId?: string, limit = 50): PipelineQueueRow[] {
  const orgId = resolveOrgId(organizationId);
  return getDb()
    .prepare(
      `SELECT * FROM pipeline_queue_items
       WHERE organization_id = ? AND status IN ('PENDING', 'ACTIVE')
       ORDER BY CASE status WHEN 'ACTIVE' THEN 0 ELSE 1 END, position ASC
       LIMIT ?`
    )
    .all(orgId, limit) as PipelineQueueRow[];
}
