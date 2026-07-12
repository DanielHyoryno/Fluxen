-- Read-only checks. Run these first and save the output before migrating.
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (table_name, column_name) IN (
    ('measurements', 'measured_at'),
    ('devices', 'last_seen_at')
  )
ORDER BY table_name, column_name;

SHOW timezone;

SELECT
  MIN(measured_at) AS oldest_measurement,
  MAX(measured_at) AS newest_measurement,
  COUNT(*) AS measurement_count
FROM public.measurements;

SELECT measured_at
FROM public.measurements
ORDER BY measured_at DESC
LIMIT 10;
