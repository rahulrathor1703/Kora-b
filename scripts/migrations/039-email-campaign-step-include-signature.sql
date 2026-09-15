ALTER TABLE email_campaign_sequence_steps
  ADD COLUMN IF NOT EXISTS include_signature boolean NOT NULL DEFAULT true;
