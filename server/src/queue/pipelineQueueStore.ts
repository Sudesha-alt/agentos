import { getDb } from "../jira-intake/sqliteStore";

export type QueueItemStatus = "PENDING" | "ACTIVE" | "COMPLETED" | "FAILED";

export interface PipelineQueueRow {
  id: number;
  ticket_id: string;
  jira_key: string;
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
}

function rowToItem(row: PipelineQueueRow): QueueItem {
  return { id: row.id, ticketId: row.ticket_id, jiraKey: row.jira_key };
}

export function enqueueQueueItem(ticketId: string, jiraKey: string): QueueItem | null {
  const db = getDb();
  const existing = db
    .prepare(
      `SELECT id FROM pipeline_queue_items
       WHERE (ticket_id = ? OR jira_key = ?) AND status IN ('PENDING', 'ACTIVE')`
    )
    .get(ticketId, jiraKey) as { id: number } | undefined;
  if (existing) return null;

  const maxPos = db
    .prepare(`SELECT COALESCE(MAX(position), 0) AS m FROM pipeline_queue_items WHERE status = 'PENDING'`)
    .get() as { m: number };
  const position = maxPos.m + 1;
  const now = new Date().toISOString();

  const result = db
    .prepare(
      `INSERT INTO pipeline_queue_items (ticket_id, jira_key, position, status, enqueued_at)
       VALUES (?, ?, ?, 'PENDING', ?)`
    )
    .run(ticketId, jiraKey, position, now);

  return {
    id: Number(result.lastInsertRowid),
    ticketId,
    jiraKey,
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

export function getActiveQueueItem(): QueueItem | null {
  const row = getDb()
    .prepare(
      `SELECT * FROM pipeline_queue_items WHERE status = 'ACTIVE' ORDER BY started_at ASC LIMIT 1`
    )
    .get() as PipelineQueueRow | undefined;
  return row ? rowToItem(row) : null;
}

export function listPendingQueueItems(): QueueItem[] {
  const rows = getDb()
    .prepare(
      `SELECT * FROM pipeline_queue_items WHERE status = 'PENDING' ORDER BY position ASC`
    )
    .all() as PipelineQueueRow[];
  return rows.map(rowToItem);
}

export function dequeueNextPending(): QueueItem | null {
  const row = getDb()
    .prepare(
      `SELECT * FROM pipeline_queue_items WHERE status = 'PENDING' ORDER BY position ASC LIMIT 1`
    )
    .get() as PipelineQueueRow | undefined;
  return row ? rowToItem(row) : null;
}

export function isTicketOrKeyQueued(ticketId: string, jiraKey: string): boolean {
  const row = getDb()
    .prepare(
      `SELECT 1 FROM pipeline_queue_items
       WHERE (ticket_id = ? OR jira_key = ?) AND status IN ('PENDING', 'ACTIVE')`
    )
    .get(ticketId, jiraKey);
  return Boolean(row);
}

export function isJiraKeyInDbQueue(jiraKey: string): boolean {
  const row = getDb()
    .prepare(
      `SELECT 1 FROM pipeline_queue_items WHERE jira_key = ? AND status IN ('PENDING', 'ACTIVE')`
    )
    .get(jiraKey);
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

export function getQueueStats(): {
  pending: number;
  active: number;
  completed: number;
} {
  const db = getDb();
  const pending =
    (db.prepare(`SELECT COUNT(*) AS c FROM pipeline_queue_items WHERE status = 'PENDING'`).get() as { c: number }).c;
  const active =
    (db.prepare(`SELECT COUNT(*) AS c FROM pipeline_queue_items WHERE status = 'ACTIVE'`).get() as { c: number }).c;
  const completed =
    (db.prepare(`SELECT COUNT(*) AS c FROM pipeline_queue_items WHERE status = 'COMPLETED'`).get() as { c: number }).c;
  return { pending, active, completed };
}

export function listQueueItems(limit = 50): PipelineQueueRow[] {
  return getDb()
    .prepare(
      `SELECT * FROM pipeline_queue_items
       WHERE status IN ('PENDING', 'ACTIVE')
       ORDER BY CASE status WHEN 'ACTIVE' THEN 0 ELSE 1 END, position ASC
       LIMIT ?`
    )
    .all(limit) as PipelineQueueRow[];
}
