-- Enable dashboard workspace module for existing organizations (on by default).
UPDATE organization_entitlements
SET enabled_modules = array_prepend('dashboard', enabled_modules)
WHERE NOT ('dashboard' = ANY(enabled_modules));

ALTER TABLE organization_entitlements
  ALTER COLUMN enabled_modules
  SET DEFAULT ARRAY['dashboard', 'email', 'crm', 'website', 'settings']::TEXT[];
