-- Org-level Notion integration token for CRM import

CREATE TABLE IF NOT EXISTS organization_notion_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  token_encrypted TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id)
);

CREATE INDEX IF NOT EXISTS idx_organization_notion_connections_org
  ON organization_notion_connections (organization_id);
