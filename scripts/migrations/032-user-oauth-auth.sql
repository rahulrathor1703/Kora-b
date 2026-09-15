ALTER TABLE users
  ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(16) NOT NULL DEFAULT 'local',
  ADD COLUMN IF NOT EXISTS google_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS apple_id VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_unique
  ON users (google_id)
  WHERE google_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_apple_id_unique
  ON users (apple_id)
  WHERE apple_id IS NOT NULL;

ALTER TABLE signup_sessions
  ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(16),
  ADD COLUMN IF NOT EXISTS oauth_subject_id VARCHAR(255);

CREATE TABLE IF NOT EXISTS platform_auth_oauth_providers (
  provider VARCHAR(16) PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  client_id VARCHAR(512),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO platform_auth_oauth_providers (provider, enabled, client_id)
VALUES
  ('google', false, NULL),
  ('apple', false, NULL)
ON CONFLICT (provider) DO NOTHING;
