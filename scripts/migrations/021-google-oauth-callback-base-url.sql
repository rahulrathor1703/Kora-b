-- Per-organization OAuth callback base URL (editable in Website Config wizard).
-- Full redirect URI = {base}/website/google-connection/oauth/callback

ALTER TABLE organization_website_settings
  ADD COLUMN IF NOT EXISTS google_oauth_callback_base_url varchar(2048);
