
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='skripsi_user') THEN
    CREATE ROLE skripsi_user LOGIN PASSWORD 'skripsi_pass';
  ELSE
    ALTER ROLE skripsi_user WITH LOGIN PASSWORD 'skripsi_pass';
  END IF;
END $$;

CREATE DATABASE skripsi_db OWNER skripsi_user;

ALTER DATABASE skripsi_db OWNER TO skripsi_user;
GRANT ALL PRIVILEGES ON DATABASE skripsi_db TO skripsi_user;

SELECT datname FROM pg_database WHERE datname='skripsi_db';
SELECT rolname FROM pg_roles WHERE rolname='skripsi_user';


-- USERS
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- DEVICE CATEGORIES
CREATE TABLE IF NOT EXISTS device_categories (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_device_categories_user
  ON device_categories(user_id, created_at DESC);

-- DEVICES
CREATE TABLE IF NOT EXISTS devices (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_code VARCHAR(50) UNIQUE NOT NULL,
  device_name VARCHAR(100) NOT NULL,
  api_token_hash TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'offline',
  category_id BIGINT REFERENCES device_categories(id) ON DELETE SET NULL,
  install_location VARCHAR(150),
  firmware_version VARCHAR(30),
  last_seen_at TIMESTAMPTZ,
  pending_command VARCHAR(30) CHECK (pending_command IN ('REPROVISION')),
  pending_command_at TIMESTAMPTZ,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- MEASUREMENTS
CREATE TABLE IF NOT EXISTS measurements (
  id BIGSERIAL PRIMARY KEY,
  device_id BIGINT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  measured_at TIMESTAMPTZ NOT NULL,
  flow_rate_lpm NUMERIC(10,3) NOT NULL,
  volume_delta_l NUMERIC(10,4) NOT NULL,
  cumulative_volume_l NUMERIC(12,4),
  pulse_count INTEGER,
  battery_voltage NUMERIC(6,3),
  rssi_dbm INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (device_id, measured_at)
);

ALTER TABLE measurements
  ADD COLUMN IF NOT EXISTS pulse_count INTEGER;

ALTER TABLE measurements
  ADD COLUMN IF NOT EXISTS battery_voltage NUMERIC(6,3);

ALTER TABLE measurements
  ADD COLUMN IF NOT EXISTS rssi_dbm INTEGER;

CREATE INDEX IF NOT EXISTS idx_measurements_device_measured_at
  ON measurements(device_id, measured_at DESC);

-- ALERTS
CREATE TABLE IF NOT EXISTS alerts (
  id BIGSERIAL PRIMARY KEY,
  device_id BIGINT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'medium',
  title VARCHAR(120) NOT NULL,
  message TEXT NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  meta JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_device_status
  ON alerts(device_id, status);

CREATE INDEX IF NOT EXISTS idx_alerts_device_type_status
  ON alerts(device_id, alert_type, status);

-- DEVICE THRESHOLDS
CREATE TABLE IF NOT EXISTS device_thresholds (
  id BIGSERIAL PRIMARY KEY,
  device_id BIGINT UNIQUE NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  leak_flow_min_lpm NUMERIC(10,3) NOT NULL DEFAULT 0.200,
  leak_duration_sec INTEGER NOT NULL DEFAULT 600,
  quiet_start_time TIME NOT NULL DEFAULT '00:00:00',
  quiet_end_time TIME NOT NULL DEFAULT '05:00:00',
  daily_usage_limit_l NUMERIC(12,3),
  monthly_usage_limit_l NUMERIC(12,3),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

ALTER TABLE devices
  ADD COLUMN IF NOT EXISTS category_id BIGINT REFERENCES device_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_devices_category_id
  ON devices(category_id);

ALTER TABLE device_thresholds
  ADD COLUMN IF NOT EXISTS daily_usage_limit_l NUMERIC(12,3);

ALTER TABLE device_thresholds
  ADD COLUMN IF NOT EXISTS monthly_usage_limit_l NUMERIC(12,3);

-- BILLING SETTINGS
CREATE TABLE IF NOT EXISTS billing_settings (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  price_per_liter NUMERIC(12,6) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'IDR',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_settings_user_id
  ON billing_settings(user_id);

ALTER TABLE billing_settings
  ADD COLUMN IF NOT EXISTS currency VARCHAR(10) NOT NULL DEFAULT 'IDR';
