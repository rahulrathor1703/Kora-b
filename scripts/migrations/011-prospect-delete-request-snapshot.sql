ALTER TABLE prospect_delete_requests
  ADD COLUMN IF NOT EXISTS prospect_full_name VARCHAR(255) NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS prospect_email VARCHAR(320) NOT NULL DEFAULT '';

UPDATE prospect_delete_requests pdr
SET
  prospect_full_name = COALESCE(p.full_name, ''),
  prospect_email = COALESCE(p.email, '')
FROM prospects p
WHERE pdr.prospect_id = p.id;

ALTER TABLE prospect_delete_requests
  DROP CONSTRAINT IF EXISTS prospect_delete_requests_prospect_id_fkey;

ALTER TABLE prospect_delete_requests
  ALTER COLUMN prospect_id DROP NOT NULL;

ALTER TABLE prospect_delete_requests
  ADD CONSTRAINT prospect_delete_requests_prospect_id_fkey
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE SET NULL;
