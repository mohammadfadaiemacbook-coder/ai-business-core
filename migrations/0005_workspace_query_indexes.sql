-- Add query indexes for workspace-scoped records without rewriting or deleting user data.
CREATE INDEX IF NOT EXISTS idx_campaigns_workspace_updated
  ON campaigns(workspace_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_audit_workspace_event_time
  ON audit_events(workspace_id, event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_publish_workspace_due
  ON publish_jobs(workspace_id, status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_approvals_workspace_status_created
  ON approval_requests(workspace_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_media_workspace_created
  ON media_assets(workspace_id, created_at);
CREATE INDEX IF NOT EXISTS idx_social_workspace_status
  ON social_accounts(workspace_id, status, connected_at);
CREATE INDEX IF NOT EXISTS idx_oauth_workspace_expiry
  ON oauth_states(workspace_id, expires_at);
