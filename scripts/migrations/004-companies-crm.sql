-- Companies CRM tables

CREATE TABLE IF NOT EXISTS company_config_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category VARCHAR(32) NOT NULL,
  value VARCHAR(64) NOT NULL,
  label VARCHAR(120) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, category, value)
);

CREATE INDEX IF NOT EXISTS idx_company_config_options_org
  ON company_config_options (organization_id);

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  broker_name VARCHAR(255) NOT NULL,
  category_id UUID REFERENCES company_config_options(id) ON DELETE SET NULL,
  location_id UUID REFERENCES company_config_options(id) ON DELETE SET NULL,
  principal_officer_name VARCHAR(255) NOT NULL DEFAULT '',
  po_email VARCHAR(320) NOT NULL DEFAULT '',
  remarks TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_org ON companies (organization_id);
CREATE INDEX IF NOT EXISTS idx_companies_org_broker_name ON companies (organization_id, broker_name);
CREATE INDEX IF NOT EXISTS idx_companies_category ON companies (category_id);
CREATE INDEX IF NOT EXISTS idx_companies_location ON companies (location_id);
