-- Organization location API settings for CRM location autocomplete

CREATE TABLE IF NOT EXISTS organization_location_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider VARCHAR(16) NOT NULL DEFAULT 'geonames',
  api_url VARCHAR(512),
  credentials_encrypted TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_location_settings_org
  ON organization_location_settings (organization_id);
