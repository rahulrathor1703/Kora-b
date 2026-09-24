CREATE TABLE organization_entitlements (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  enabled_modules TEXT[] NOT NULL DEFAULT ARRAY['email', 'crm', 'website', 'settings']::TEXT[],
  platform_caps JSONB NOT NULL DEFAULT '{}',
  org_limits JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO organization_entitlements (organization_id, enabled_modules, platform_caps)
SELECT
  id,
  ARRAY['email', 'crm', 'website', 'settings']::TEXT[],
  jsonb_build_object(
    'email.mailboxes', 50,
    'email.campaigns', 100,
    'crm.prospects', 10000,
    'crm.companies', 10000,
    'website.projects', 50,
    'settings.members', 100
  )
FROM organizations
ON CONFLICT (organization_id) DO NOTHING;
