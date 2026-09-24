-- Meeting scheduling fields and platform cleanup

ALTER TABLE meetings
  ADD COLUMN IF NOT EXISTS description TEXT NULL,
  ADD COLUMN IF NOT EXISTS agenda TEXT NULL,
  ADD COLUMN IF NOT EXISTS meeting_url VARCHAR(512) NULL,
  ADD COLUMN IF NOT EXISTS external_event_id VARCHAR(255) NULL;

UPDATE meetings SET platform = 'google' WHERE platform = 'gmail';

UPDATE meetings SET platform = 'outlook' WHERE platform = 'physical';
