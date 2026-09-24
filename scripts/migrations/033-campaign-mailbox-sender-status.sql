ALTER TABLE email_campaign_mailbox_senders
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active';
