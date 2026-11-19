BEGIN;

SET LOCAL lock_timeout = '5s';
ALTER TABLE users ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR(128);
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_firebase_uid
  ON users (firebase_uid) WHERE firebase_uid IS NOT NULL;

COMMIT;
