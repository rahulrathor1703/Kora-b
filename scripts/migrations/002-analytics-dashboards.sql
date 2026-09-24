-- Production migration: analytics dashboards and widgets
-- Run manually when deploying to production (synchronize is disabled).

CREATE TABLE IF NOT EXISTS analytics_dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  visibility VARCHAR(16) NOT NULL DEFAULT 'private',
  global_filters JSONB NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_dashboards_organization
  ON analytics_dashboards (organization_id);

CREATE INDEX IF NOT EXISTS idx_analytics_dashboards_created_by
  ON analytics_dashboards (created_by_user_id);

CREATE TABLE IF NOT EXISTS analytics_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID NOT NULL REFERENCES analytics_dashboards(id) ON DELETE CASCADE,
  name VARCHAR(160) NOT NULL,
  metric VARCHAR(32) NOT NULL,
  group_by VARCHAR(32) NOT NULL,
  chart_type VARCHAR(16) NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_widgets_dashboard
  ON analytics_widgets (dashboard_id);
