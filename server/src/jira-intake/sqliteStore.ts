import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { intakeConfig } from "./config";
import type { ParsedJiraIssue } from "./jiraEventParser";

let db: Database.Database | undefined;

function nowIso(): string {
  return new Date().toISOString();
}

export function initIntakeDb(): Database.Database {
  const dbPath = path.resolve(intakeConfig.sqlitePath);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  db = new Database(dbPath);
  const schema = fs.readFileSync(
    path.join(__dirname, "db", "schema.sql"),
    "utf8"
  );
  db.exec(schema);
  migrateGitCredentialsTable(db);
  return db;
}

function migrateGitCredentialsTable(database: Database.Database): void {
  const columns = database.prepare("PRAGMA table_info(git_credentials)").all() as Array<{
    name: string;
  }>;
  const names = new Set(columns.map((col) => col.name));
  if (!names.has("installation_id")) {
    database.exec("ALTER TABLE git_credentials ADD COLUMN installation_id TEXT");
  }
  if (!names.has("auth_method")) {
    database.exec(
      "ALTER TABLE git_credentials ADD COLUMN auth_method TEXT NOT NULL DEFAULT 'pat'"
    );
  }
}

export function getDb(): Database.Database {
  if (!db) initIntakeDb();
  return db!;
}

export function upsertAiWorkerIssue(issue: ParsedJiraIssue): void {
  const now = nowIso();
  getDb()
    .prepare(
      `
    INSERT INTO ai_worker_issues (
      issue_key, issue_id, summary, description, status_name, issue_type,
      project_key, assignee, reporter, priority, labels_json,
      active, first_seen_at, last_seen_at, updated_at
    ) VALUES (
      @issueKey, @issueId, @summary, @description, @statusName, @issueType,
      @projectKey, @assignee, @reporter, @priority, @labelsJson,
      1, @now, @now, @now
    )
    ON CONFLICT(issue_key) DO UPDATE SET
      issue_id = excluded.issue_id,
      summary = excluded.summary,
      description = excluded.description,
      status_name = excluded.status_name,
      issue_type = excluded.issue_type,
      project_key = excluded.project_key,
      assignee = excluded.assignee,
      reporter = excluded.reporter,
      priority = excluded.priority,
      labels_json = excluded.labels_json,
      active = 1,
      last_seen_at = excluded.last_seen_at,
      updated_at = excluded.updated_at
  `
    )
    .run({
      issueKey: issue.issueKey,
      issueId: issue.issueId,
      summary: issue.summary,
      description: issue.description,
      statusName: issue.statusName,
      issueType: issue.issueType,
      projectKey: issue.projectKey,
      assignee: issue.assignee,
      reporter: issue.reporter,
      priority: issue.priority,
      labelsJson: JSON.stringify(issue.labels || []),
      now,
    });
}

export function deactivateAiWorkerIssue(issueKey: string): void {
  const now = nowIso();
  getDb()
    .prepare(
      `UPDATE ai_worker_issues SET active = 0, updated_at = ?, last_seen_at = ? WHERE issue_key = ?`
    )
    .run(now, now, issueKey);
}

interface AiWorkerRow {
  issue_key: string;
  issue_id: string;
  summary: string | null;
  description: string | null;
  status_name: string;
  issue_type: string | null;
  project_key: string | null;
  assignee: string | null;
  reporter: string | null;
  priority: string | null;
  labels_json: string | null;
  active: number;
  first_seen_at: string;
  last_seen_at: string;
  updated_at: string;
}

export function listAiWorkerIssues(active?: string | boolean): AiWorkerRow[] {
  if (active === "1" || active === true) {
    return getDb()
      .prepare(
        `SELECT * FROM ai_worker_issues WHERE active = 1 ORDER BY last_seen_at DESC`
      )
      .all() as AiWorkerRow[];
  }
  if (active === "0" || active === false) {
    return getDb()
      .prepare(
        `SELECT * FROM ai_worker_issues WHERE active = 0 ORDER BY last_seen_at DESC`
      )
      .all() as AiWorkerRow[];
  }
  return getDb()
    .prepare(`SELECT * FROM ai_worker_issues ORDER BY last_seen_at DESC`)
    .all() as AiWorkerRow[];
}

export function getQueueStats(): {
  active: number;
  inactive: number;
  total: number;
} {
  const database = getDb();
  const active = (
    database
      .prepare(`SELECT COUNT(*) AS n FROM ai_worker_issues WHERE active = 1`)
      .get() as { n: number }
  ).n;
  const inactive = (
    database
      .prepare(`SELECT COUNT(*) AS n FROM ai_worker_issues WHERE active = 0`)
      .get() as { n: number }
  ).n;
  return { active, inactive, total: active + inactive };
}

export function rowToApi(row: AiWorkerRow) {
  return {
    issueKey: row.issue_key,
    issueId: row.issue_id,
    summary: row.summary,
    description: row.description,
    status: row.status_name,
    issueType: row.issue_type,
    projectKey: row.project_key,
    assignee: row.assignee,
    reporter: row.reporter,
    priority: row.priority,
    labels: row.labels_json ? JSON.parse(row.labels_json) : [],
    active: row.active === 1,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    updatedAt: row.updated_at,
  };
}
