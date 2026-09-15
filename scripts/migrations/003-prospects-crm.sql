-- Prospects CRM tables

CREATE TABLE IF NOT EXISTS prospect_field_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  fields JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id)
);

CREATE INDEX IF NOT EXISTS idx_prospect_field_schemas_org
  ON prospect_field_schemas (organization_id);

CREATE TABLE IF NOT EXISTS prospects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL DEFAULT '',
  email VARCHAR(320) NOT NULL DEFAULT '',
  values JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospects_org ON prospects (organization_id);
CREATE INDEX IF NOT EXISTS idx_prospects_org_full_name ON prospects (organization_id, full_name);
CREATE INDEX IF NOT EXISTS idx_prospects_org_email ON prospects (organization_id, email);

CREATE TABLE IF NOT EXISTS prospect_engagements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  type VARCHAR(32) NOT NULL,
  discussion TEXT NOT NULL,
  outcome VARCHAR(32) NOT NULL,
  next_step VARCHAR(500),
  created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospect_engagements_prospect
  ON prospect_engagements (prospect_id);
