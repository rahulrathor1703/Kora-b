-- Production migration: per-message link registry for signed click tracking
-- Run manually when deploying to production (synchronize is disabled).

ALTER TABLE email_campaign_messages
  ADD COLUMN IF NOT EXISTS tracked_links JSONB NOT NULL DEFAULT '[]';
