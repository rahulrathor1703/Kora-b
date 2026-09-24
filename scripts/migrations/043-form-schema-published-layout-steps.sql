-- Published layout/steps snapshots for platform forms (org rows ignore these columns)
ALTER TABLE form_schemas
  ADD COLUMN IF NOT EXISTS published_layout JSONB,
  ADD COLUMN IF NOT EXISTS published_steps JSONB;

UPDATE form_schemas
SET
  published_layout = layout,
  published_steps = steps
WHERE organization_id IS NULL;
