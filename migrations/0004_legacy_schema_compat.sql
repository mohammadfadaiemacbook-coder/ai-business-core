-- Bring pre-v2 tables forward without dropping or rebuilding user data.
-- Columns are nullable/defaulted so existing rows remain valid; legacy rows are
-- assigned to the default workspace where that association is unambiguous.

ALTER TABLE content_items ADD COLUMN workspace_id TEXT;
UPDATE content_items SET workspace_id = 'default' WHERE workspace_id IS NULL;
ALTER TABLE content_items ADD COLUMN content_type TEXT NOT NULL DEFAULT 'post';
ALTER TABLE content_items ADD COLUMN caption TEXT;
ALTER TABLE content_items ADD COLUMN script TEXT;
ALTER TABLE content_items ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE content_items ADD COLUMN similarity_report_json TEXT;

ALTER TABLE media_assets ADD COLUMN workspace_id TEXT;
UPDATE media_assets SET workspace_id = 'default' WHERE workspace_id IS NULL;
ALTER TABLE media_assets ADD COLUMN content_item_id TEXT;
ALTER TABLE media_assets ADD COLUMN provider TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE media_assets ADD COLUMN model TEXT;
ALTER TABLE media_assets ADD COLUMN asset_type TEXT NOT NULL DEFAULT 'file';
ALTER TABLE media_assets ADD COLUMN mime_type TEXT;
ALTER TABLE media_assets ADD COLUMN width INTEGER;
ALTER TABLE media_assets ADD COLUMN height INTEGER;
ALTER TABLE media_assets ADD COLUMN duration_seconds REAL;
ALTER TABLE media_assets ADD COLUMN metadata_json TEXT NOT NULL DEFAULT '{}';

ALTER TABLE approval_requests ADD COLUMN workspace_id TEXT;
UPDATE approval_requests SET workspace_id = 'default' WHERE workspace_id IS NULL;
ALTER TABLE approval_requests ADD COLUMN action_type TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE approval_requests ADD COLUMN target_account_id TEXT;
ALTER TABLE approval_requests ADD COLUMN content_item_id TEXT;
ALTER TABLE approval_requests ADD COLUMN content_version INTEGER;
ALTER TABLE approval_requests ADD COLUMN payload_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE approval_requests ADD COLUMN payload_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE approval_requests ADD COLUMN expires_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z';
ALTER TABLE approval_requests ADD COLUMN reviewed_at TEXT;
ALTER TABLE approval_requests ADD COLUMN reviewed_by TEXT;
UPDATE approval_requests SET payload_hash = content_hash WHERE payload_hash = '';

ALTER TABLE publish_jobs ADD COLUMN workspace_id TEXT;
UPDATE publish_jobs SET workspace_id = 'default' WHERE workspace_id IS NULL;
ALTER TABLE publish_jobs ADD COLUMN approval_request_id TEXT;
ALTER TABLE publish_jobs ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE publish_jobs ADD COLUMN platform_post_id TEXT;
ALTER TABLE publish_jobs ADD COLUMN platform_url TEXT;
ALTER TABLE publish_jobs ADD COLUMN last_error TEXT;
ALTER TABLE publish_jobs ADD COLUMN idempotency_key TEXT;
UPDATE publish_jobs SET idempotency_key = 'legacy-' || id WHERE idempotency_key IS NULL;

ALTER TABLE campaigns ADD COLUMN brief_json TEXT NOT NULL DEFAULT '{}';
ALTER TABLE campaigns ADD COLUMN language TEXT NOT NULL DEFAULT 'fa';
ALTER TABLE campaigns ADD COLUMN audience TEXT;
ALTER TABLE campaigns ADD COLUMN content_pillars_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE campaigns ADD COLUMN updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'));

ALTER TABLE audit_events ADD COLUMN actor_id TEXT;
ALTER TABLE audit_events ADD COLUMN event_type TEXT NOT NULL DEFAULT 'legacy.event';
ALTER TABLE audit_events ADD COLUMN target_type TEXT;
ALTER TABLE audit_events ADD COLUMN target_id TEXT;
ALTER TABLE audit_events ADD COLUMN details_json TEXT NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_content_workspace ON content_items(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_approvals_workspace_status ON approval_requests(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_publish_jobs_due ON publish_jobs(status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_media_workspace ON media_assets(workspace_id, created_at);
