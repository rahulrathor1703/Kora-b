CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL DEFAULT '',
  actor_email TEXT NOT NULL DEFAULT '',
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  http_method TEXT NOT NULL,
  request_path TEXT NOT NULL,
  status_code INT NOT NULL,
  message TEXT NOT NULL,
  resource_type TEXT NULL,
  resource_id TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_org_created
  ON audit_logs (organization_id, created_at DESC);

CREATE INDEX idx_audit_logs_org_module_created
  ON audit_logs (organization_id, module, created_at DESC);

CREATE INDEX idx_audit_logs_org_action_created
  ON audit_logs (organization_id, action, created_at DESC);

CREATE INDEX idx_audit_logs_actor_created
  ON audit_logs (actor_user_id, created_at DESC);
