-- Campaign recipient manual pause-until and reply override for sequence resume.
-- Run manually when deploying to production (synchronize is disabled).

ALTER TABLE email_campaign_recipients
  ADD COLUMN IF NOT EXISTS paused_until timestamptz NULL,
  ADD COLUMN IF NOT EXISTS allow_send_despite_reply boolean NOT NULL DEFAULT false;
