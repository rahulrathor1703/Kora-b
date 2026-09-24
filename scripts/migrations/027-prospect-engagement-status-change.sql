-- Prospect engagement status change metadata

ALTER TABLE prospect_engagements
  ADD COLUMN IF NOT EXISTS from_stage_value VARCHAR(255),
  ADD COLUMN IF NOT EXISTS to_stage_value VARCHAR(255),
  ADD COLUMN IF NOT EXISTS from_stage_label VARCHAR(255),
  ADD COLUMN IF NOT EXISTS to_stage_label VARCHAR(255);
