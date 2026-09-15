-- Production migration: website config Google OAuth, PSI settings, property integrations
-- Run manually when deploying to production (synchronize is disabled).

CREATE TABLE IF NOT EXISTS organization_google_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  expires_at TIMESTAMPTZ,
  scopes TEXT,
  connected_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organization_google_connections_org
  ON organization_google_connections (organization_id);

CREATE TABLE IF NOT EXISTS organization_website_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  psi_api_key_encrypted TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organization_website_settings_org
  ON organization_website_settings (organization_id);

ALTER TABLE website_properties
  ADD COLUMN IF NOT EXISTS ga4_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ga4_property_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS ga4_property_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS gsc_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS gsc_site_url VARCHAR(512),
  ADD COLUMN IF NOT EXISTS psi_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_website_properties_org_domain
  ON website_properties (organization_id, domain);
