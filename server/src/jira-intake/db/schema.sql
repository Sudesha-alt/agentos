CREATE TABLE IF NOT EXISTS ai_worker_issues (
  issue_key       TEXT PRIMARY KEY,
  issue_id        TEXT NOT NULL,
  summary         TEXT,
  description     TEXT,
  status_name     TEXT NOT NULL,
  issue_type      TEXT,
  project_key     TEXT,
  assignee        TEXT,
  reporter        TEXT,
  priority        TEXT,
  labels_json     TEXT,
  active          INTEGER NOT NULL DEFAULT 1,
  first_seen_at   TEXT NOT NULL,
  last_seen_at    TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_worker_active ON ai_worker_issues(active);
