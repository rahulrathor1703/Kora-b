-- Multiple Google OAuth apps per organization; link connections to the app that created them.

CREATE TABLE IF NOT EXISTS organization_google_oauth_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  label VARCHAR(256) NOT NULL DEFAULT 'Default',
  google_oauth_client_id VARCHAR(512) NOT NULL,
  google_oauth_client_secret_encrypted TEXT NOT NULL,
  google_oauth_callback_base_url VARCHAR(2048) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organization_google_oauth_apps_org
  ON organization_google_oauth_apps (organization_id);

-- Migrate existing per-org OAuth credentials into the new table.
INSERT INTO organization_google_oauth_apps (
  organization_id,
  label,
  google_oauth_client_id,
  google_oauth_client_secret_encrypted,
  google_oauth_callback_base_url
)
SELECT
  organization_id,
  'Default',
  google_oauth_client_id,
  google_oauth_client_secret_encrypted,
  COALESCE(
    google_oauth_callback_base_url,
    'http://localhost:3008'
  )
FROM organization_website_settings
WHERE google_oauth_client_id IS NOT NULL
  AND google_oauth_client_secret_encrypted IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM organization_google_oauth_apps apps
    WHERE apps.organization_id = organization_website_settings.organization_id
  );

ALTER TABLE organization_google_connections
  ADD COLUMN IF NOT EXISTS oauth_app_id UUID REFERENCES organization_google_oauth_apps(id) ON DELETE RESTRICT;

-- Backfill connections to the migrated default app for their org.
UPDATE organization_google_connections connection
SET oauth_app_id = app.id
FROM organization_google_oauth_apps app
WHERE connection.organization_id = app.organization_id
  AND connection.oauth_app_id IS NULL;

ALTER TABLE organization_google_connections
  ALTER COLUMN oauth_app_id SET NOT NULL;

DROP INDEX IF EXISTS "IDX_organization_google_connections_organization_id_email";

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_google_connections_oauth_app_email
  ON organization_google_connections (oauth_app_id, email);

ALTER TABLE organization_website_settings
  DROP COLUMN IF EXISTS google_oauth_client_id,
  DROP COLUMN IF EXISTS google_oauth_client_secret_encrypted,
  DROP COLUMN IF EXISTS google_oauth_callback_base_url;
