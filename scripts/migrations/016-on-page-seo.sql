-- Production migration: on-page SEO audits and website properties
-- Run manually when deploying to production (synchronize is disabled).

CREATE TABLE IF NOT EXISTS website_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  domain VARCHAR(255) NOT NULL,
  sitemap_url VARCHAR(512) NOT NULL,
  max_pages INT NOT NULL DEFAULT 20,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_website_properties_organization
  ON website_properties (organization_id);

ALTER TABLE website_properties
  ADD COLUMN IF NOT EXISTS ga4_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ga4_property_id VARCHAR(128),
  ADD COLUMN IF NOT EXISTS ga4_property_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS gsc_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS gsc_site_url VARCHAR(512),
  ADD COLUMN IF NOT EXISTS psi_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS on_page_audit_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  website_property_id UUID NOT NULL REFERENCES website_properties(id) ON DELETE CASCADE,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  pages_audited INT NOT NULL DEFAULT 0,
  pages_failed INT NOT NULL DEFAULT 0,
  summary JSONB NOT NULL DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_on_page_audit_runs_organization
  ON on_page_audit_runs (organization_id);

CREATE INDEX IF NOT EXISTS idx_on_page_audit_runs_property_started
  ON on_page_audit_runs (website_property_id, started_at DESC);

CREATE TABLE IF NOT EXISTS on_page_page_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_run_id UUID NOT NULL REFERENCES on_page_audit_runs(id) ON DELETE CASCADE,
  url VARCHAR(2048) NOT NULL,
  http_status INT,
  scrape_failed BOOLEAN NOT NULL DEFAULT FALSE,
  meta_title TEXT NOT NULL DEFAULT '',
  meta_desc TEXT NOT NULL DEFAULT '',
  meta_title_length INT NOT NULL DEFAULT 0,
  meta_desc_length INT NOT NULL DEFAULT 0,
  h1s JSONB NOT NULL DEFAULT '[]',
  h2s JSONB NOT NULL DEFAULT '[]',
  h3s JSONB NOT NULL DEFAULT '[]',
  word_count INT NOT NULL DEFAULT 0,
  is_thin_content BOOLEAN NOT NULL DEFAULT FALSE,
  image_count INT NOT NULL DEFAULT 0,
  missing_alt_count INT NOT NULL DEFAULT 0,
  internal_link_count INT NOT NULL DEFAULT 0,
  generic_anchor_count INT NOT NULL DEFAULT 0,
  sentence_case_violations JSONB NOT NULL DEFAULT '[]',
  issues JSONB NOT NULL DEFAULT '[]',
  issue_count INT NOT NULL DEFAULT 0,
  seo_score INT NOT NULL DEFAULT 100,
  checks JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_on_page_page_results_audit_run
  ON on_page_page_results (audit_run_id);
