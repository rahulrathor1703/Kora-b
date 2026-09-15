-- Production migration: shared org-level Google OAuth connections
-- Run manually when deploying to production (synchronize is disabled).

-- Allow multiple Google accounts per organization
ALTER TABLE organization_google_connections
  DROP CONSTRAINT IF EXISTS organization_google_connections_organization_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_organization_google_connections_org_email
  ON organization_google_connections (organization_id, email);

-- Link website properties to shared org Google connections
ALTER TABLE website_properties
  ADD COLUMN IF NOT EXISTS google_connection_id UUID
  REFERENCES organization_google_connections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_website_properties_google_connection
  ON website_properties (google_connection_id);

-- Migrate per-property tokens into the org pool (dedupe by org + email)
INSERT INTO organization_google_connections (
  organization_id,
  email,
  access_token_encrypted,
  refresh_token_encrypted,
  expires_at,
  scopes,
  connected_by_user_id,
  connected_at,
  updated_at
)
SELECT DISTINCT ON (wp.organization_id, wpgc.email)
  wp.organization_id,
  wpgc.email,
  wpgc.access_token_encrypted,
  wpgc.refresh_token_encrypted,
  wpgc.expires_at,
  wpgc.scopes,
  wpgc.connected_by_user_id,
  wpgc.connected_at,
  wpgc.updated_at
FROM website_property_google_connections wpgc
JOIN website_properties wp ON wp.id = wpgc.website_property_id
WHERE NOT EXISTS (
  SELECT 1
  FROM organization_google_connections ogc
  WHERE ogc.organization_id = wp.organization_id
    AND ogc.email = wpgc.email
)
ORDER BY wp.organization_id, wpgc.email, wpgc.updated_at DESC;

UPDATE website_properties wp
SET google_connection_id = ogc.id
FROM website_property_google_connections wpgc
JOIN organization_google_connections ogc
  ON ogc.email = wpgc.email
WHERE wpgc.website_property_id = wp.id
  AND ogc.organization_id = wp.organization_id
  AND wp.google_connection_id IS NULL;

DROP TABLE IF EXISTS website_property_google_connections;
