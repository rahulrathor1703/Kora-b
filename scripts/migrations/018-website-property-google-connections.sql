-- Production migration: per-website Google OAuth connections
-- Run manually when deploying to production (synchronize is disabled).

CREATE TABLE IF NOT EXISTS website_property_google_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_property_id UUID NOT NULL UNIQUE REFERENCES website_properties(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  expires_at TIMESTAMPTZ,
  scopes TEXT,
  connected_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_website_property_google_connections_property
  ON website_property_google_connections (website_property_id);
