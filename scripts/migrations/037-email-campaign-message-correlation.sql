ALTER TABLE email_campaign_messages
  ADD COLUMN IF NOT EXISTS mailbox_id UUID,
  ADD COLUMN IF NOT EXISTS sent_subject VARCHAR(998);

CREATE INDEX IF NOT EXISTS idx_email_campaign_messages_mailbox_id
  ON email_campaign_messages (mailbox_id);

-- send_failed events used delivery_status 'bounced'; normalize to 'failed'
UPDATE email_campaign_messages AS message
SET delivery_status = 'failed'
FROM email_campaign_events AS event
WHERE event.message_id = message.id
  AND event.event_type = 'send_failed'
  AND message.delivery_status = 'bounced';
