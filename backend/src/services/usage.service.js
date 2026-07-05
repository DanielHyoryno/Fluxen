const pool = require("../config/db");

async function findDeviceByCode(userId, deviceCode) {
  const deviceQ = await pool.query(
    `SELECT id, device_code, device_name, status, last_seen_at
     FROM devices
     WHERE user_id = $1 AND device_code = $2
     LIMIT 1`,
    [userId, deviceCode]
  );

  if (deviceQ.rowCount === 0) {
    throw new Error("DEVICE_NOT_FOUND");
  }

  return deviceQ.rows[0];
}

async function getUsageLimits(userId, deviceCode) {
  const device = await findDeviceByCode(userId, deviceCode);

  const thresholdQ = await pool.query(
    `SELECT daily_usage_limit_l, monthly_usage_limit_l, updated_at
     FROM device_thresholds
     WHERE device_id = $1
     LIMIT 1`,
    [device.id]
  );

  const thresholds = thresholdQ.rows[0] || {
    daily_usage_limit_l: null,
    monthly_usage_limit_l: null,
    updated_at: null,
  };

  return {
    device_code: device.device_code,
    device_name: device.device_name,
    status: device.status,
    last_seen_at: device.last_seen_at,
    daily_usage_limit_l: thresholds.daily_usage_limit_l,
    monthly_usage_limit_l: thresholds.monthly_usage_limit_l,
    updated_at: thresholds.updated_at,
  };
}

async function upsertUsageLimits(userId, payload) {
  const device = await findDeviceByCode(userId, payload.device_code);

  const existingQ = await pool.query(
    `SELECT daily_usage_limit_l, monthly_usage_limit_l
     FROM device_thresholds
     WHERE device_id = $1
     LIMIT 1`,
    [device.id]
  );

  const nextDaily =
    payload.daily_usage_limit_l === undefined
      ? existingQ.rows[0]?.daily_usage_limit_l ?? null
      : payload.daily_usage_limit_l;
  const nextMonthly =
    payload.monthly_usage_limit_l === undefined
      ? existingQ.rows[0]?.monthly_usage_limit_l ?? null
      : payload.monthly_usage_limit_l;

  const upsertQ = await pool.query(
    `INSERT INTO device_thresholds (device_id, daily_usage_limit_l, monthly_usage_limit_l)
     VALUES ($1, $2, $3)
     ON CONFLICT (device_id)
     DO UPDATE SET
       daily_usage_limit_l = EXCLUDED.daily_usage_limit_l,
       monthly_usage_limit_l = EXCLUDED.monthly_usage_limit_l,
       updated_at = NOW()
     RETURNING daily_usage_limit_l, monthly_usage_limit_l, updated_at`,
    [
      device.id,
      nextDaily,
      nextMonthly,
    ]
  );

  return {
    device_code: device.device_code,
    daily_usage_limit_l: upsertQ.rows[0].daily_usage_limit_l,
    monthly_usage_limit_l: upsertQ.rows[0].monthly_usage_limit_l,
    updated_at: upsertQ.rows[0].updated_at,
  };
}

async function listUsageAlerts(userId, query) {
  const device = await findDeviceByCode(userId, query.device_code);
  const status = query.status || "active";
  const limit = query.limit || 50;

  const alertsQ = await pool.query(
    `SELECT id, alert_type, severity, title, message, triggered_at, resolved_at, status, meta
     FROM alerts
     WHERE device_id = $1
       AND alert_type IN ('USAGE_LIMIT_DAILY', 'USAGE_LIMIT_MONTHLY')
       AND status = $2
     ORDER BY triggered_at DESC
     LIMIT $3`,
    [device.id, status, limit]
  );

  return {
    device_code: device.device_code,
    status_filter: status,
    items: alertsQ.rows,
  };
}

async function listAllUsageAlerts(userId, query) {
  const status = query.status || "active";
  const limit = query.limit || 50;

  const alertsQ = await pool.query(
    `SELECT a.id,
            a.alert_type,
            a.severity,
            a.title,
            a.message,
            a.triggered_at,
            a.resolved_at,
            a.status,
            a.meta,
            d.device_code,
            d.device_name
     FROM alerts a
     JOIN devices d ON d.id = a.device_id
     WHERE d.user_id = $1
       AND a.alert_type IN ('USAGE_LIMIT_DAILY', 'USAGE_LIMIT_MONTHLY')
       AND a.status = $2
     ORDER BY a.triggered_at DESC
     LIMIT $3`,
    [userId, status, limit]
  );

  return {
    status_filter: status,
    items: alertsQ.rows,
  };
}

async function dismissAlert(userId, alertId) {
  // Verify the alert belongs to a device owned by this user
  const alertQ = await pool.query(
    `SELECT a.id, a.status, a.device_id
     FROM alerts a
     JOIN devices d ON d.id = a.device_id
     WHERE a.id = $1 AND d.user_id = $2
     LIMIT 1`,
    [alertId, userId]
  );

  if (alertQ.rowCount === 0) {
    throw new Error("ALERT_NOT_FOUND");
  }

  if (alertQ.rows[0].status === "resolved") {
    return { id: alertId, status: "resolved", already_resolved: true };
  }

  const updateQ = await pool.query(
    `UPDATE alerts
     SET status = 'resolved', resolved_at = NOW()
     WHERE id = $1
     RETURNING id, status, resolved_at`,
    [alertId]
  );

  return updateQ.rows[0];
}

module.exports = {
  getUsageLimits,
  upsertUsageLimits,
  listUsageAlerts,
  listAllUsageAlerts,
  dismissAlert,
};
