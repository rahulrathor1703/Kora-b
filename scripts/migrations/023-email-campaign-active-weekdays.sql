ALTER TABLE email_campaigns
ADD COLUMN IF NOT EXISTS active_weekdays text;

UPDATE email_campaigns
SET active_weekdays = '0,1,2,3,4,5,6'
WHERE active_weekdays IS NULL;
