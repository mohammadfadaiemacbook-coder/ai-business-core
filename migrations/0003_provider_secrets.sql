-- Encrypted provider credentials. Schema is applied once through Wrangler migrations.
CREATE TABLE IF NOT EXISTS provider_secrets (
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  secret_key TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  PRIMARY KEY (workspace_id, secret_key)
);
CREATE INDEX IF NOT EXISTS idx_provider_secrets_workspace ON provider_secrets(workspace_id);
