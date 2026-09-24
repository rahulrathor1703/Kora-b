-- Platform form draft vs published snapshots (org rows ignore these columns)
ALTER TABLE form_schemas
  ADD COLUMN IF NOT EXISTS published_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS published_table_columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS published_version INT NOT NULL DEFAULT 1;

UPDATE form_schemas
SET
  published_fields = fields,
  published_table_columns = COALESCE(table_columns, '[]'::jsonb),
  published_version = GREATEST(version, 1)
WHERE organization_id IS NULL;
