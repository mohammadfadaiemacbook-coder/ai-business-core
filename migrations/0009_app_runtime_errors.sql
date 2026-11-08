CREATE TABLE IF NOT EXISTS app_runtime_errors (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  message TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  occurred_at TEXT NOT NULL,
  request_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_runtime_errors_workspace_time
  ON app_runtime_errors(workspace_id, occurred_at DESC);
