-- Convert prospect product field from single select to multiselect arrays

UPDATE prospects
SET values = jsonb_set(
  values,
  '{product}',
  CASE
    WHEN values ->> 'product' = 'all' THEN '["insureops", "benefit-care"]'::jsonb
    WHEN values ->> 'product' IS NOT NULL AND values ->> 'product' != '' THEN
      jsonb_build_array(values ->> 'product')
    ELSE '[]'::jsonb
  END,
  true
),
updated_at = NOW()
WHERE values ? 'product'
  AND (
    jsonb_typeof(values -> 'product') IS DISTINCT FROM 'array'
    OR values ->> 'product' = 'all'
  );

UPDATE prospect_field_schemas
SET fields = COALESCE(
  (
    SELECT jsonb_agg(
      CASE
        WHEN field ->> 'key' = 'product' THEN
          jsonb_set(
            jsonb_set(field, '{type}', '"multiselect"'),
            '{options}',
            COALESCE(
              (
                SELECT jsonb_agg(option_item)
                FROM jsonb_array_elements(field -> 'options') AS option_item
                WHERE option_item ->> 'value' IS DISTINCT FROM 'all'
              ),
              '[]'::jsonb
            )
          )
        ELSE field
      END
      ORDER BY ordinality
    )
    FROM jsonb_array_elements(fields) WITH ORDINALITY AS t(field, ordinality)
  ),
  '[]'::jsonb
),
updated_at = NOW()
WHERE EXISTS (
  SELECT 1
  FROM jsonb_array_elements(fields) AS field
  WHERE field ->> 'key' = 'product'
);
