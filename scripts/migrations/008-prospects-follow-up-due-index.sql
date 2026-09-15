CREATE INDEX IF NOT EXISTS idx_prospects_follow_up_due
  ON prospects ((values ->> 'followUpDue'))
  WHERE values ->> 'followUpDue' IS NOT NULL;
