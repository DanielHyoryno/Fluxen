-- Queue a one-time command for an ESP32 while keeping its device token valid
-- until the firmware acknowledges the command.
BEGIN;

SET LOCAL lock_timeout = '10s';

ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS pending_command VARCHAR(30),
  ADD COLUMN IF NOT EXISTS pending_command_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'devices_pending_command_check'
      AND conrelid = 'public.devices'::regclass
  ) THEN
    ALTER TABLE public.devices
      ADD CONSTRAINT devices_pending_command_check
      CHECK (pending_command IS NULL OR pending_command IN ('REPROVISION'));
  END IF;
END $$;

COMMIT;
