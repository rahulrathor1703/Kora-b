-- Universal form schemas: platform baselines (organization_id NULL) + org extensions
CREATE TABLE IF NOT EXISTS form_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_key VARCHAR(128) NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  steps JSONB,
  layout JSONB,
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_form_schemas_key_org UNIQUE (form_key, organization_id)
);

CREATE INDEX IF NOT EXISTS idx_form_schemas_form_key ON form_schemas(form_key);
CREATE INDEX IF NOT EXISTS idx_form_schemas_organization_id ON form_schemas(organization_id);

-- Migrate org-only custom prospect fields (keys not in platform default)
WITH org_prospect_extensions AS (
  SELECT
    pfs.organization_id,
    COALESCE(
      (
        SELECT jsonb_agg(f ORDER BY (f->>'sortOrder')::int)
        FROM jsonb_array_elements(pfs.fields) AS f
        WHERE f->>'key' NOT IN (
          'fullName', 'email', 'designation', 'phone', 'product', 'crmStatus',
          'emailStatus', 'score', 'bantTier', 'source', 'followUpDue', 'remarks'
        )
      ),
      '[]'::jsonb
    ) AS custom_fields
  FROM prospect_field_schemas pfs
)
INSERT INTO form_schemas (form_key, organization_id, fields, version)
SELECT 'crm.prospect.create', organization_id, custom_fields, 1
FROM org_prospect_extensions
WHERE jsonb_array_length(custom_fields) > 0
ON CONFLICT (form_key, organization_id) DO NOTHING;

INSERT INTO form_schemas (form_key, organization_id, fields, version)
SELECT 'crm.prospect.detail', organization_id, fields, version
FROM form_schemas
WHERE form_key = 'crm.prospect.create' AND organization_id IS NOT NULL
ON CONFLICT (form_key, organization_id) DO NOTHING;

-- Migrate org-only custom company fields
WITH org_company_extensions AS (
  SELECT
    cfs.organization_id,
    COALESCE(
      (
        SELECT jsonb_agg(f ORDER BY (f->>'sortOrder')::int)
        FROM jsonb_array_elements(cfs.fields) AS f
        WHERE f->>'key' NOT IN (
          'brokerName', 'categoryId', 'principalOfficerName', 'poEmail', 'remarks'
        )
      ),
      '[]'::jsonb
    ) AS custom_fields
  FROM company_field_schemas cfs
)
INSERT INTO form_schemas (form_key, organization_id, fields, version)
SELECT 'crm.company.create', organization_id, custom_fields, 1
FROM org_company_extensions
WHERE jsonb_array_length(custom_fields) > 0
ON CONFLICT (form_key, organization_id) DO NOTHING;

INSERT INTO form_schemas (form_key, organization_id, fields, version)
SELECT 'crm.company.detail', organization_id, fields, version
FROM form_schemas
WHERE form_key = 'crm.company.create' AND organization_id IS NOT NULL
ON CONFLICT (form_key, organization_id) DO NOTHING;
