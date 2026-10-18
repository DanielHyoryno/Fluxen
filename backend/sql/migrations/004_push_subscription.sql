-- Additive migration: one receiving phone per user. Existing accounts stay unchanged.
BEGIN;
SET LOCAL lock_timeout = '5s';
-- Do not expose newly stored phone tokens through an unrestricted Supabase Data API.
-- An operator must first verify backend DB-role compatibility and enable users RLS
-- (or remove public table SELECT grants). Never silently change existing policies here.
DO $$
DECLARE api_role TEXT;
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'users'::regclass) THEN
    FOR api_role IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated') LOOP
      IF has_table_privilege(api_role, 'users', 'SELECT') THEN
        RAISE EXCEPTION 'Secure users table access before storing push tokens (RLS/SELECT grants)';
      END IF;
    END LOOP;
  END IF;
END $$;
ALTER TABLE users ADD COLUMN IF NOT EXISTS push_subscription JSONB;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_push_subscription_token
  ON users ((push_subscription->>'token')) WHERE push_subscription IS NOT NULL;
COMMIT;
