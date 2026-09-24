-- Production migration: per-organization Google OAuth app credentials (SaaS)
-- Run manually when deploying to production (synchronize is disabled).

ALTER TABLE organization_website_settings
  ADD COLUMN IF NOT EXISTS google_oauth_client_id VARCHAR(512),
  ADD COLUMN IF NOT EXISTS google_oauth_client_secret_encrypted TEXT;
