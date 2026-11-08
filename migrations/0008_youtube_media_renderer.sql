-- Durable video binaries and retryable local-renderer queue.
CREATE TABLE IF NOT EXISTS youtube_media_assets (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0),
  asset_type TEXT NOT NULL CHECK (asset_type IN ('source_video','rendered_video')),
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready','deleted')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_youtube_media_assets_workspace_created
  ON youtube_media_assets(workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS youtube_render_jobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  draft_id TEXT,
  source_asset_id TEXT NOT NULL REFERENCES youtube_media_assets(id),
  output_asset_id TEXT REFERENCES youtube_media_assets(id),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','ready_for_review','failed','cancelled')),
  stage TEXT NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 5),
  lease_owner TEXT,
  lease_expires_at TEXT,
  last_error TEXT,
  qa_report_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_youtube_render_jobs_claim
  ON youtube_render_jobs(status, lease_expires_at, created_at);
CREATE INDEX IF NOT EXISTS idx_youtube_render_jobs_workspace
  ON youtube_render_jobs(workspace_id, updated_at DESC);
