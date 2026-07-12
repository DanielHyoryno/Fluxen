const pool = require("../config/db");
const env = require("../config/env");
const { toBusinessDateKey, toBusinessMonthKey } = require("../utils/datetime");

async function getOwnedDeviceId(client, userId, deviceCode) {
  const q = await client.query(
    `SELECT id
     FROM devices
     WHERE user_id = $1 AND device_code = $2
     LIMIT 1`,
    [userId, deviceCode]
  );

  if (q.rowCount === 0) {
    throw new Error("DEVICE_NOT_FOUND");
  }

  return q.rows[0].id;
}

function buildUsageAlertMessage(periodLabel, consumedLiters, limitLiters) {
  return `Usage exceeded for ${periodLabel}: ${Number(consumedLiters).toFixed(3)} L (limit ${Number(
    limitLiters
  ).toFixed(3)} L)`;
}

async function createUsageLimitAlertIfNeeded(client, params) {
  const { deviceId, measuredAt } = params;

  const usageQ = await client.query(
    `SELECT
       dt.daily_usage_limit_l,
       dt.monthly_usage_limit_l,
       COALESCE((
         SELECT SUM(m.volume_delta_l)
         FROM measurements m
         WHERE m.device_id = $1
           AND (m.measured_at AT TIME ZONE $3)::date = ($2::timestamptz AT TIME ZONE $3)::date
       ), 0) AS daily_total_l,
       COALESCE((
         SELECT SUM(m.volume_delta_l)
         FROM measurements m
         WHERE m.device_id = $1
           AND date_trunc('month', m.measured_at AT TIME ZONE $3) =
               date_trunc('month', $2::timestamptz AT TIME ZONE $3)
       ), 0) AS monthly_total_l
     FROM device_thresholds dt
     WHERE dt.device_id = $1
     LIMIT 1`,
    [deviceId, measuredAt, env.businessTimezone]
  );

  if (usageQ.rowCount === 0) return [];

  const usage = usageQ.rows[0];
  const triggeredAlerts = [];
  const periodConfigs = [
    {
      alertType: "USAGE_LIMIT_DAILY",
      periodKey: toBusinessDateKey(measuredAt),
      periodLabel: "daily",
      limitValue: usage.daily_usage_limit_l,
      consumedValue: usage.daily_total_l,
    },
    {
      alertType: "USAGE_LIMIT_MONTHLY",
      periodKey: toBusinessMonthKey(measuredAt),
      periodLabel: "monthly",
      limitValue: usage.monthly_usage_limit_l,
      consumedValue: usage.monthly_total_l,
    },
  ];

  for (const config of periodConfigs) {
    const hasLimit = config.limitValue !== null && Number(config.limitValue) > 0;
    if (!hasLimit || Number(config.consumedValue) <= Number(config.limitValue)) {
      continue;
    }

    const existingQ = await client.query(
      `SELECT id
       FROM alerts
       WHERE device_id = $1
         AND alert_type = $2
         AND status = 'active'
         AND meta->>'period_key' = $3
       LIMIT 1`,
      [deviceId, config.alertType, config.periodKey]
    );

    if (existingQ.rowCount > 0) {
      continue;
    }

    const message = buildUsageAlertMessage(config.periodLabel, config.consumedValue, config.limitValue);
    const meta = {
      period_key: config.periodKey,
      consumed_l: Number(config.consumedValue),
      limit_l: Number(config.limitValue),
    };

    await client.query(
      `INSERT INTO alerts (device_id, alert_type, severity, title, message, triggered_at, status, meta)
       VALUES ($1, $2, 'medium', $3, $4, NOW(), 'active', $5::jsonb)`,
      [deviceId, config.alertType, `${config.periodLabel} usage limit exceeded`, message, JSON.stringify(meta)]
    );

    triggeredAlerts.push({
      alert_type: config.alertType,
      period_key: config.periodKey,
      consumed_l: Number(config.consumedValue),
      limit_l: Number(config.limitValue),
    });
  }

  return triggeredAlerts;
}

async function createTelemetry(payload) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const deviceQ = await client.query(
      `SELECT id FROM devices WHERE device_code = $1 LIMIT 1`,
      [payload.device_code]
    );

    if (deviceQ.rowCount === 0) throw new Error("DEVICE_NOT_FOUND");

    const deviceId = deviceQ.rows[0].id;

    const insertQ = await client.query(
      `INSERT INTO measurements
      (device_id, measured_at, flow_rate_lpm, volume_delta_l, cumulative_volume_l, pulse_count, battery_voltage, rssi_dbm)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING id`,
      [
        deviceId,
        payload.measured_at,
        payload.flow_rate_lpm,
        payload.volume_delta_l,
        payload.cumulative_volume_l ?? null,
        payload.pulse_count ?? null,
        payload.battery_voltage ?? null,
        payload.rssi_dbm ?? null,
      ]
    );

    await client.query(
      `UPDATE devices
       SET last_seen_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [deviceId]
    );

    const triggeredAlerts = await createUsageLimitAlertIfNeeded(client, {
      deviceId,
      measuredAt: payload.measured_at,
    });

    await client.query("COMMIT");
    return {
      telemetry_id: insertQ.rows[0].id,
      alerts_triggered: triggeredAlerts,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function createTelemetryBatch(payload) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const deviceQ = await client.query(
      `SELECT id FROM devices WHERE device_code = $1 LIMIT 1`,
      [payload.device_code]
    );

    if (deviceQ.rowCount === 0) throw new Error("DEVICE_NOT_FOUND");

    const deviceId = deviceQ.rows[0].id;

    let insertedCount = 0;
    let duplicateCount = 0;

    for (const record of payload.records) {
      const insertQ = await client.query(
        `INSERT INTO measurements
         (device_id, measured_at, flow_rate_lpm, volume_delta_l, cumulative_volume_l, pulse_count, battery_voltage, rssi_dbm)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (device_id, measured_at) DO NOTHING
         RETURNING id`,
        [
          deviceId,
          record.measured_at,
          record.flow_rate_lpm,
          record.volume_delta_l,
          record.cumulative_volume_l ?? null,
          record.pulse_count ?? null,
          record.battery_voltage ?? null,
          record.rssi_dbm ?? null,
        ]
      );

      if (insertQ.rowCount === 0) {
        duplicateCount += 1;
      } else {
        insertedCount += 1;
      }
    }

    await client.query(
      `UPDATE devices
       SET last_seen_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [deviceId]
    );

    const lastMeasuredAt = payload.records[payload.records.length - 1].measured_at;
    const triggeredAlerts = await createUsageLimitAlertIfNeeded(client, {
      deviceId,
      measuredAt: lastMeasuredAt,
    });

    await client.query("COMMIT");
    return {
      device_code: payload.device_code,
      received_count: payload.records.length,
      inserted_count: insertedCount,
      duplicate_count: duplicateCount,
      alerts_triggered: triggeredAlerts,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function getLatestTelemetry(userId, deviceCode) {
  const deviceId = await getOwnedDeviceId(pool, userId, deviceCode);

  const q = await pool.query(
    `SELECT m.id, d.device_code, m.measured_at, m.flow_rate_lpm, m.volume_delta_l,
            m.cumulative_volume_l, m.pulse_count, m.battery_voltage, m.rssi_dbm
     FROM measurements m
     JOIN devices d ON d.id = m.device_id
     WHERE m.device_id = $1
     ORDER BY m.measured_at DESC
     LIMIT 1`,
    [deviceId]
  );

  return q.rows[0] || null;
}

async function getDailyTelemetry(userId, deviceCode, date) {
  const deviceId = await getOwnedDeviceId(pool, userId, deviceCode);

  const q = await pool.query(
    `SELECT m.measured_at, m.flow_rate_lpm, m.volume_delta_l, m.cumulative_volume_l
     FROM measurements m
     WHERE m.device_id = $1
       AND (m.measured_at AT TIME ZONE $3)::date = $2::date
     ORDER BY m.measured_at ASC`,
    [deviceId, date, env.businessTimezone]
  );

  return q.rows;
}

async function getUsageHistory(userId, deviceCode, from, to) {
  const deviceId = await getOwnedDeviceId(pool, userId, deviceCode);

  const q = await pool.query(
    `SELECT (m.measured_at AT TIME ZONE $4)::date AS date,
            SUM(m.volume_delta_l) AS total_liters,
            AVG(m.flow_rate_lpm) AS avg_flow_rate_lpm,
            MAX(m.flow_rate_lpm) AS peak_flow_rate_lpm,
            COUNT(*) AS reading_count
     FROM measurements m
     WHERE m.device_id = $1
       AND m.measured_at >= ($2::date::timestamp AT TIME ZONE $4)
       AND m.measured_at < (($3::date + 1)::timestamp AT TIME ZONE $4)
     GROUP BY (m.measured_at AT TIME ZONE $4)::date
     ORDER BY date ASC`,
    [deviceId, from, to, env.businessTimezone]
  );

  return q.rows;
}

async function getExportData(userId, deviceCode, from, to) {
  const deviceId = await getOwnedDeviceId(pool, userId, deviceCode);

  const q = await pool.query(
    `SELECT m.measured_at, m.flow_rate_lpm, m.volume_delta_l,
            m.cumulative_volume_l, m.pulse_count, m.battery_voltage, m.rssi_dbm
     FROM measurements m
     WHERE m.device_id = $1
       AND m.measured_at >= ($2::date::timestamp AT TIME ZONE $4)
       AND m.measured_at < (($3::date + 1)::timestamp AT TIME ZONE $4)
     ORDER BY m.measured_at ASC`,
    [deviceId, from, to, env.businessTimezone]
  );

  return q.rows;
}

module.exports = {
  createTelemetry,
  createTelemetryBatch,
  getLatestTelemetry,
  getDailyTelemetry,
  getUsageHistory,
  getExportData,
};
