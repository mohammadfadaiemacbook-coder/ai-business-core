-- Durable YouTube production drafts shared by every PWA device.
CREATE TABLE IF NOT EXISTS youtube_video_jobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  script_text TEXT NOT NULL DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  production_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','queued','rendering','ready_for_review','approved','uploading','scheduled','published','failed','cancelled')),
  stage TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TEXT,
  youtube_video_id TEXT,
  error_text TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_youtube_video_jobs_workspace_updated
  ON youtube_video_jobs(workspace_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_youtube_video_jobs_status_schedule
  ON youtube_video_jobs(status, scheduled_at);
