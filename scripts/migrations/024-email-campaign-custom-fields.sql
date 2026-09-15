-- Email campaign custom field definitions and options

CREATE TABLE IF NOT EXISTS email_campaign_custom_field_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  label VARCHAR(120) NOT NULL,
  key VARCHAR(64) NOT NULL,
  type VARCHAR(16) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, key)
);

CREATE INDEX IF NOT EXISTS idx_email_campaign_custom_field_definitions_org
  ON email_campaign_custom_field_definitions (organization_id);

CREATE TABLE IF NOT EXISTS email_campaign_custom_field_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  field_definition_id UUID NOT NULL
    REFERENCES email_campaign_custom_field_definitions(id) ON DELETE CASCADE,
  label VARCHAR(120) NOT NULL,
  value VARCHAR(64) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (field_definition_id, value)
);

CREATE INDEX IF NOT EXISTS idx_email_campaign_custom_field_options_field
  ON email_campaign_custom_field_options (field_definition_id);

ALTER TABLE email_campaigns
ADD COLUMN IF NOT EXISTS custom_field_values JSONB NOT NULL DEFAULT '{}'::jsonb;
