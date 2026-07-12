CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE device_categories (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, name)
);

CREATE TABLE devices (
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE measurements (
  id BIGSERIAL PRIMARY KEY,
  device_id BIGINT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  measured_at TIMESTAMPTZ NOT NULL,
  flow_rate_lpm NUMERIC(10,3) NOT NULL,
  volume_delta_l NUMERIC(10,4) NOT NULL,
  cumulative_volume_l NUMERIC(12,4),
  pulse_count INTEGER,
  battery_voltage NUMERIC(6,3),
  rssi_dbm INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (device_id, measured_at)
);

CREATE TABLE alerts (
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE device_thresholds (
  id BIGSERIAL PRIMARY KEY,
  device_id BIGINT UNIQUE NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  leak_flow_min_lpm NUMERIC(10,3) NOT NULL DEFAULT 0.200,
  leak_duration_sec INTEGER NOT NULL DEFAULT 600,
  quiet_start_time TIME NOT NULL DEFAULT '00:00:00',
  quiet_end_time TIME NOT NULL DEFAULT '05:00:00',
  daily_usage_limit_l NUMERIC(12,3),
  monthly_usage_limit_l NUMERIC(12,3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE billing_settings (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  price_per_liter NUMERIC(12,6) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'IDR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
