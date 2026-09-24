-- Meetings CRM table

CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  prospect_id UUID NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
  platform VARCHAR(16) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'scheduled',
  title VARCHAR(255) NULL,
  start_at TIMESTAMPTZ NULL,
  end_at TIMESTAMPTZ NULL,
  created_by_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meetings_org ON meetings (organization_id);
CREATE INDEX IF NOT EXISTS idx_meetings_org_status ON meetings (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_meetings_org_start_at ON meetings (organization_id, start_at);
CREATE INDEX IF NOT EXISTS idx_meetings_prospect ON meetings (prospect_id);
