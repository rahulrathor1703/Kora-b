-- Per-campaign mailbox send quotas and daily quota usage tracking

ALTER TABLE email_campaign_mailbox_senders
ADD COLUMN IF NOT EXISTS daily_send_quota INT NULL;

ALTER TABLE email_campaign_mailbox_senders
ADD COLUMN IF NOT EXISTS sends_today_count INT NOT NULL DEFAULT 0;

ALTER TABLE email_campaign_mailbox_senders
ADD COLUMN IF NOT EXISTS sends_today_date DATE NULL;
