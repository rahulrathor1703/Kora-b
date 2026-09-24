CREATE TABLE organization_campaign_id_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  format VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_organization_campaign_id_settings_org
  ON organization_campaign_id_settings (organization_id);

ALTER TABLE email_campaigns
  ADD COLUMN IF NOT EXISTS campaign_public_id VARCHAR(128);

CREATE UNIQUE INDEX idx_email_campaigns_org_public_id
  ON email_campaigns (organization_id, campaign_public_id)
  WHERE campaign_public_id IS NOT NULL;
