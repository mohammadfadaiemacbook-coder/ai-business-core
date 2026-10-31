CREATE TABLE IF NOT EXISTS api_rate_limits (
  bucket_key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket_key, window_start)
);
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_window ON api_rate_limits(window_start);
