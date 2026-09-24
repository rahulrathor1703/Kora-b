CREATE TABLE email_campaign_delete_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES email_campaigns(id) ON DELETE SET NULL,
  campaign_name VARCHAR(255) NOT NULL DEFAULT '',
  campaign_status VARCHAR(16) NOT NULL DEFAULT '',
  reason TEXT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  requested_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reviewed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  review_note TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ecdr_org_status ON email_campaign_delete_requests (organization_id, status);

CREATE UNIQUE INDEX idx_ecdr_pending_campaign ON email_campaign_delete_requests (campaign_id)
  WHERE status = 'pending';
