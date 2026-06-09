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

CREATE TABLE IF NOT EXISTS pipeline_jira_credentials (
  singleton_id              INTEGER PRIMARY KEY CHECK (singleton_id = 1),
  base_url                  TEXT,
  email                     TEXT,
  api_token                 TEXT,
  webhook_secret            TEXT,
  project_keys_json         TEXT NOT NULL DEFAULT '[]',
  board_id                  TEXT,
  ai_worker_column_name     TEXT,
  ai_worker_statuses_json   TEXT,
  updated_at                TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS canary_runtime_settings (
  singleton_id          INTEGER PRIMARY KEY CHECK (singleton_id = 1),
  staging_base_url      TEXT,
  production_base_url   TEXT,
  auth_token            TEXT,
  updated_at            TEXT NOT NULL
);
