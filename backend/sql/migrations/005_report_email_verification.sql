BEGIN;

-- Apply on the backend's configured schema/search_path. OTP data has no Data API policies.
CREATE TABLE IF NOT EXISTS report_email_verifications (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(150) NOT NULL,
  code_digest TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  verified_at TIMESTAMPTZ
);

ALTER TABLE report_email_verifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE report_email_verifications FROM PUBLIC;

COMMIT;
