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

CREATE TABLE IF NOT EXISTS jira_credentials (
  singleton_id      INTEGER PRIMARY KEY CHECK (singleton_id = 1),
  base_url          TEXT,
  email             TEXT,
  api_token         TEXT,
  board_id          TEXT,
  webhook_secret    TEXT,
  updated_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jira_integration_config (
  singleton_id            INTEGER PRIMARY KEY CHECK (singleton_id = 1),
  working_column_name     TEXT,
  next_column_name        TEXT,
  working_statuses_json   TEXT NOT NULL DEFAULT '[]',
  updated_at              TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS git_credentials (
  singleton_id      INTEGER PRIMARY KEY CHECK (singleton_id = 1),
  provider          TEXT NOT NULL,
  workspace         TEXT NOT NULL,
  repo_slug         TEXT NOT NULL,
  username          TEXT,
  token             TEXT,
  webhook_secret    TEXT,
  default_branch    TEXT NOT NULL DEFAULT 'main',
  installation_id   TEXT,
  auth_method       TEXT NOT NULL DEFAULT 'pat',
  updated_at        TEXT NOT NULL
);
