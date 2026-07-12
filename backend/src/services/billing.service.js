const pool = require("../config/db");
const env = require("../config/env");

let categorySupportCache = null;
let categorySupportCacheAt = 0;

async function getCategorySupport() {
  const now = Date.now();
  if (categorySupportCache && now - categorySupportCacheAt < 10_000) {
    return categorySupportCache;
  }

  const q = await pool.query(
    `SELECT
       to_regclass($1) IS NOT NULL AS has_categories_table,
       to_regclass($2) IS NOT NULL AS has_device_category_map_table,
       EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = $3
           AND table_name = 'devices'
           AND column_name = 'category_id'
       ) AS has_device_category_column`,
    [`${env.dbSchema}.device_categories`, `${env.dbSchema}.device_category_map`, env.dbSchema]
  );

  categorySupportCache = {
    hasCategoriesTable: Boolean(q.rows[0]?.has_categories_table),
    hasDeviceCategoryMapTable: Boolean(q.rows[0]?.has_device_category_map_table),
    hasDeviceCategoryColumn: Boolean(q.rows[0]?.has_device_category_column),
  };
  categorySupportCacheAt = now;
  return categorySupportCache;
}

async function getOwnedCategory(userId, categoryId) {
  if (categoryId === undefined || categoryId === null) {
    return null;
  }

  const support = await getCategorySupport();
  if (!support.hasCategoriesTable) {
    throw new Error("CATEGORY_SCHEMA_NOT_READY");
  }

  const categoryQ = await pool.query(
    `SELECT id, name
     FROM device_categories
     WHERE id = $1 AND user_id = $2
     LIMIT 1`,
    [categoryId, userId]
  );

  if (categoryQ.rowCount === 0) {
    throw new Error("CATEGORY_NOT_FOUND");
  }

  return categoryQ.rows[0];
}

async function getBillingSettings(userId) {
  const settingsQ = await pool.query(
    `SELECT price_per_liter, currency, created_at, updated_at
     FROM billing_settings
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );

  if (settingsQ.rowCount === 0) {
    return {
      price_per_liter: null,
      currency: "IDR",
      created_at: null,
      updated_at: null,
    };
  }

  return settingsQ.rows[0];
}

async function upsertBillingSettings(userId, payload) {
  const settingsQ = await pool.query(
    `INSERT INTO billing_settings (user_id, price_per_liter, currency)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id)
     DO UPDATE SET
       price_per_liter = EXCLUDED.price_per_liter,
       currency = EXCLUDED.currency,
       updated_at = NOW()
     RETURNING price_per_liter, currency, created_at, updated_at`,
    [userId, payload.price_per_liter, payload.currency]
  );

  return settingsQ.rows[0];
}

async function listBillingDevices(userId, filters) {
  const support = await getCategorySupport();

  if (Array.isArray(filters.device_ids) && filters.device_ids.length === 0) {
    return [];
  }

  const conditions = ["d.user_id = $1"];
  const values = [userId];
  let categoryJoin = "";
  let categoryIdSelect = "NULL::BIGINT AS category_id";
  let categoryNameSelect = "NULL::VARCHAR AS category_name";

  if (support.hasCategoriesTable && support.hasDeviceCategoryColumn) {
    categoryJoin = "LEFT JOIN device_categories c ON c.id = d.category_id";
    categoryIdSelect = "d.category_id";
    categoryNameSelect = "c.name AS category_name";
  } else if (support.hasCategoriesTable && support.hasDeviceCategoryMapTable) {
    categoryJoin = "LEFT JOIN device_category_map m ON m.device_id = d.id LEFT JOIN device_categories c ON c.id = m.category_id";
    categoryIdSelect = "m.category_id";
    categoryNameSelect = "c.name AS category_name";
  }

  if (filters.category_id !== undefined && filters.category_id !== null && support.hasCategoriesTable) {
    values.push(filters.category_id);
    if (support.hasDeviceCategoryColumn) {
      conditions.push(`d.category_id = $${values.length}`);
    } else if (support.hasDeviceCategoryMapTable) {
      conditions.push(`m.category_id = $${values.length}`);
    }
  }

  if (filters.device_ids?.length) {
    values.push(filters.device_ids);
    conditions.push(`d.id = ANY($${values.length}::bigint[])`);
  }

  const devicesQ = await pool.query(
    `SELECT d.id, d.device_code, d.device_name, d.install_location, ${categoryIdSelect}, ${categoryNameSelect}
     FROM devices d
     ${categoryJoin}
     WHERE ${conditions.join(" AND ")}
     ORDER BY d.created_at DESC`,
    values
  );

  return devicesQ.rows;
}

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

async function estimateBill(userId, payload) {
  const [settings, category] = await Promise.all([
    getBillingSettings(userId),
    getOwnedCategory(userId, payload.category_id),
  ]);

  if (settings.price_per_liter === null) {
    throw new Error("BILLING_SETTINGS_NOT_FOUND");
  }

  const devices = await listBillingDevices(userId, payload);
  const requestedDeviceIds = (payload.device_ids || []).map((id) => Number(id));
  const matchedDeviceIds = new Set(devices.map((device) => Number(device.id)));

  if (requestedDeviceIds.length > 0 && requestedDeviceIds.some((deviceId) => !matchedDeviceIds.has(deviceId))) {
    throw new Error("DEVICE_NOT_FOUND");
  }

  if (devices.length === 0) {
    return {
      settings,
      filters: {
        from: payload.from,
        to: payload.to,
        category_id: payload.category_id ?? null,
        category_name: category?.name || null,
        device_ids: requestedDeviceIds,
      },
      summary: {
        device_count: 0,
        total_liters: 0,
        estimated_cost: 0,
        currency: settings.currency,
      },
      items: [],
    };
  }

  const measurementQ = await pool.query(
    `SELECT m.device_id,
            COALESCE(SUM(m.volume_delta_l), 0) AS total_liters,
            AVG(m.flow_rate_lpm) AS avg_flow_rate_lpm,
            MAX(m.flow_rate_lpm) AS peak_flow_rate_lpm,
            COUNT(*) AS reading_count
     FROM measurements m
     WHERE m.device_id = ANY($1::bigint[])
       AND m.measured_at >= ($2::date::timestamp AT TIME ZONE $4)
       AND m.measured_at < (($3::date + 1)::timestamp AT TIME ZONE $4)
     GROUP BY m.device_id`,
    [devices.map((device) => device.id), payload.from, payload.to, env.businessTimezone]
  );

  const measurementByDeviceId = new Map(
    measurementQ.rows.map((row) => [
      row.device_id,
      {
        total_liters: toNumber(row.total_liters),
        avg_flow_rate_lpm: row.avg_flow_rate_lpm === null ? null : toNumber(row.avg_flow_rate_lpm),
        peak_flow_rate_lpm: row.peak_flow_rate_lpm === null ? null : toNumber(row.peak_flow_rate_lpm),
        reading_count: toNumber(row.reading_count),
      },
    ])
  );

  const pricePerLiter = toNumber(settings.price_per_liter);
  const items = devices.map((device) => {
    const measurement = measurementByDeviceId.get(device.id) || {
      total_liters: 0,
      avg_flow_rate_lpm: null,
      peak_flow_rate_lpm: null,
      reading_count: 0,
    };
    const estimatedCost = measurement.total_liters * pricePerLiter;

    return {
      device_id: device.id,
      device_code: device.device_code,
      device_name: device.device_name,
      install_location: device.install_location,
      category_id: device.category_id,
      category_name: device.category_name,
      total_liters: measurement.total_liters,
      avg_flow_rate_lpm: measurement.avg_flow_rate_lpm,
      peak_flow_rate_lpm: measurement.peak_flow_rate_lpm,
      reading_count: measurement.reading_count,
      estimated_cost: estimatedCost,
      currency: settings.currency,
    };
  });

  const summary = items.reduce(
    (acc, item) => {
      acc.total_liters += item.total_liters;
      acc.estimated_cost += item.estimated_cost;
      return acc;
    },
    {
      device_count: items.length,
      total_liters: 0,
      estimated_cost: 0,
      currency: settings.currency,
    }
  );

  return {
    settings,
    filters: {
      from: payload.from,
      to: payload.to,
      category_id: payload.category_id ?? null,
      category_name: category?.name || null,
      device_ids: items.map((item) => item.device_id),
    },
    summary,
    items,
  };
}

module.exports = {
  getBillingSettings,
  upsertBillingSettings,
  estimateBill,
};
