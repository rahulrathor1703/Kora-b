-- Company field schema + values migration

CREATE TABLE IF NOT EXISTS company_field_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  fields JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id)
);

CREATE INDEX IF NOT EXISTS idx_company_field_schemas_org
  ON company_field_schemas (organization_id);

ALTER TABLE companies ADD COLUMN IF NOT EXISTS values JSONB NOT NULL DEFAULT '{}';

UPDATE companies
SET values = jsonb_strip_nulls(
  jsonb_build_object(
    'categoryId', category_id::text,
    'locationId', location_id::text,
    'principalOfficerName', NULLIF(principal_officer_name, ''),
    'poEmail', NULLIF(po_email, ''),
    'remarks', NULLIF(remarks, '')
  )
)
WHERE values = '{}'::jsonb OR values IS NULL;

ALTER TABLE companies DROP COLUMN IF EXISTS category_id;
ALTER TABLE companies DROP COLUMN IF EXISTS location_id;
ALTER TABLE companies DROP COLUMN IF EXISTS principal_officer_name;
ALTER TABLE companies DROP COLUMN IF EXISTS po_email;
ALTER TABLE companies DROP COLUMN IF EXISTS remarks;

DROP INDEX IF EXISTS idx_companies_category;
DROP INDEX IF EXISTS idx_companies_location;
