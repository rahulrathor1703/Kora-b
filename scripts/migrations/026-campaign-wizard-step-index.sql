ALTER TABLE email_campaigns
  ADD COLUMN IF NOT EXISTS wizard_step_index smallint;
