-- Remove legacy location fields from company/prospect schemas and record values

UPDATE company_field_schemas
SET fields = COALESCE(
  (
    SELECT jsonb_agg(field)
    FROM jsonb_array_elements(fields) AS field
    WHERE field->>'key' IS DISTINCT FROM 'locationId'
  ),
  '[]'::jsonb
),
updated_at = NOW()
WHERE fields @> '[{"key": "locationId"}]'::jsonb
   OR EXISTS (
     SELECT 1
     FROM jsonb_array_elements(fields) AS field
     WHERE field->>'key' = 'locationId'
   );

UPDATE companies
SET values = values - 'locationId',
    updated_at = NOW()
WHERE values ? 'locationId';

UPDATE prospect_field_schemas
SET fields = COALESCE(
  (
    SELECT jsonb_agg(field)
    FROM jsonb_array_elements(fields) AS field
    WHERE field->>'key' IS DISTINCT FROM 'region'
  ),
  '[]'::jsonb
),
updated_at = NOW()
WHERE fields @> '[{"key": "region"}]'::jsonb
   OR EXISTS (
     SELECT 1
     FROM jsonb_array_elements(fields) AS field
     WHERE field->>'key' = 'region'
   );

UPDATE prospects
SET values = values - 'region',
    updated_at = NOW()
WHERE values ? 'region';
