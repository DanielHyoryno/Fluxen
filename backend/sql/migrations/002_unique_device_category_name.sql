-- Category names are unique per user after trimming and case folding.
-- This migration aborts when existing duplicates are present so no category
-- is renamed or deleted implicitly.
BEGIN;

SET LOCAL lock_timeout = '10s';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.device_categories
    GROUP BY user_id, LOWER(BTRIM(name))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Duplicate category names exist. Resolve duplicates per user before applying this migration.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_device_categories_user_name_ci
  ON public.device_categories (user_id, LOWER(BTRIM(name)));

COMMIT;
