BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS account_email_challenges (
  email VARCHAR(150) NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('register', 'reset')),
  code_digest TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  reset_token_digest TEXT UNIQUE,
  reset_expires_at TIMESTAMPTZ,
  PRIMARY KEY (email, purpose)
);

ALTER TABLE account_email_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE account_email_challenges FROM PUBLIC;

COMMIT;
