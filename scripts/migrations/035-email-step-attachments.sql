CREATE TABLE email_step_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  campaign_step_id UUID REFERENCES email_campaign_sequence_steps(id) ON DELETE CASCADE,
  template_step_id UUID REFERENCES email_template_steps(id) ON DELETE CASCADE,
  original_filename VARCHAR(255) NOT NULL,
  stored_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(128) NOT NULL,
  size_bytes INT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (campaign_step_id IS NOT NULL AND template_step_id IS NULL) OR
    (campaign_step_id IS NULL AND template_step_id IS NOT NULL)
  )
);

CREATE INDEX idx_email_step_attachments_campaign_step
  ON email_step_attachments (campaign_step_id);

CREATE INDEX idx_email_step_attachments_template_step
  ON email_step_attachments (template_step_id);

CREATE INDEX idx_email_step_attachments_organization
  ON email_step_attachments (organization_id);
