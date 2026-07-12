-- Existing TIMESTAMP WITHOUT TIME ZONE values are assumed to represent UTC.
-- Back up the database and inspect sample values before applying this migration.
-- The type checks make the migration safe to re-run when the columns are already
-- TIMESTAMPTZ; unexpected types abort the transaction.
BEGIN;

DO $$
DECLARE
  measured_at_type TEXT;
  last_seen_at_type TEXT;
BEGIN
  SELECT data_type INTO measured_at_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'measurements'
    AND column_name = 'measured_at';

  IF measured_at_type = 'timestamp without time zone' THEN
    ALTER TABLE public.measurements
      ALTER COLUMN measured_at TYPE TIMESTAMPTZ
      USING measured_at AT TIME ZONE 'UTC';
  ELSIF measured_at_type IS DISTINCT FROM 'timestamp with time zone' THEN
    RAISE EXCEPTION 'Unexpected measurements.measured_at type: %', measured_at_type;
  END IF;

  SELECT data_type INTO last_seen_at_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'devices'
    AND column_name = 'last_seen_at';

  IF last_seen_at_type = 'timestamp without time zone' THEN
    ALTER TABLE public.devices
      ALTER COLUMN last_seen_at TYPE TIMESTAMPTZ
      USING last_seen_at AT TIME ZONE 'UTC';
  ELSIF last_seen_at_type IS DISTINCT FROM 'timestamp with time zone' THEN
    RAISE EXCEPTION 'Unexpected devices.last_seen_at type: %', last_seen_at_type;
  END IF;
END $$;

COMMIT;
