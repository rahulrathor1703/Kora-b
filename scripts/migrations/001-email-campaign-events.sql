-- Production migration: email campaign event log
-- Run manually when deploying to production (synchronize is disabled).

CREATE TABLE IF NOT EXISTS email_campaign_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES email_campaigns(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES email_campaign_recipients(id) ON DELETE CASCADE,
  message_id UUID REFERENCES email_campaign_messages(id) ON DELETE CASCADE,
  event_type VARCHAR(16) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_email_campaign_events_campaign_occurred
  ON email_campaign_events (campaign_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_campaign_events_recipient_occurred
  ON email_campaign_events (recipient_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_email_campaign_events_message
  ON email_campaign_events (message_id);
