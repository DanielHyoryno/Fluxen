const bcrypt = require("bcrypt");
const crypto = require("crypto");
const pool = require("../config/db");
const env = require("../config/env");

const TOKEN_SALT_ROUNDS = 10;

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

async function ensureCategoryOwnership(userId, categoryId) {
    if (categoryId === undefined || categoryId === null) {
        return null;
    }

    const support = await getCategorySupport();
    if (!support.hasCategoriesTable) {
        throw new Error("CATEGORY_SCHEMA_NOT_READY");
    }

    const q = await pool.query(
        `SELECT id
     FROM device_categories
     WHERE id = $1 AND user_id = $2
     LIMIT 1`,
        [categoryId, userId]
    );

    if (q.rowCount === 0) {
        throw new Error("CATEGORY_NOT_FOUND");
    }

    return categoryId;
}

function createDeviceToken() {
    return crypto.randomBytes(24).toString("hex");
}

async function createDevice(userId, payload) {
    const support = await getCategorySupport();
    const hasCategoryWritableSchema = support.hasDeviceCategoryColumn || support.hasDeviceCategoryMapTable;
    if (payload.category_id !== undefined && payload.category_id !== null && !hasCategoryWritableSchema) {
        throw new Error("CATEGORY_SCHEMA_NOT_READY");
    }

    const categoryId = await ensureCategoryOwnership(userId, payload.category_id);
    const apiToken = createDeviceToken();
    const apiTokenHash = await bcrypt.hash(apiToken, TOKEN_SALT_ROUNDS);

    const created = support.hasDeviceCategoryColumn
        ? await pool.query(
              `INSERT INTO devices (user_id, device_code, device_name, api_token_hash, category_id, install_location, firmware_version)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
              [
                  userId,
                  payload.device_code.trim(),
                  payload.device_name.trim(),
                  apiTokenHash,
                  categoryId,
                  payload.install_location || null,
                  payload.firmware_version || null,
              ]
          )
        : await pool.query(
              `INSERT INTO devices (user_id, device_code, device_name, api_token_hash, install_location, firmware_version)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
              [
                  userId,
                  payload.device_code.trim(),
                  payload.device_name.trim(),
                  apiTokenHash,
                  payload.install_location || null,
                  payload.firmware_version || null,
              ]
          );

    const device = await getDeviceById(userId, created.rows[0].id);

    if (!support.hasDeviceCategoryColumn && support.hasDeviceCategoryMapTable && categoryId !== null) {
        await pool.query(
            `INSERT INTO device_category_map (device_id, category_id)
       VALUES ($1, $2)
       ON CONFLICT (device_id)
       DO UPDATE SET category_id = EXCLUDED.category_id, updated_at = NOW()`,
            [created.rows[0].id, categoryId]
        );
    }

    return {
        ...(await getDeviceById(userId, created.rows[0].id)),
        api_token: apiToken,
    };
}

// A device is considered online if it reported within the last 2 minutes.
const ONLINE_THRESHOLD_SEC = 120;

async function listDevices(userId) {
    const support = await getCategorySupport();
    const q =
        support.hasCategoriesTable && support.hasDeviceCategoryColumn
            ? await pool.query(
                  `SELECT d.id, d.user_id, d.device_code, d.device_name,
                d.category_id, c.name AS category_name,
                CASE
                  WHEN d.last_seen_at IS NOT NULL
                       AND d.last_seen_at > NOW() - INTERVAL '${ONLINE_THRESHOLD_SEC} seconds'
                  THEN 'online'
                  ELSE 'offline'
                END AS status,
                d.install_location, d.firmware_version, d.last_seen_at, d.created_at, d.updated_at
         FROM devices d
         LEFT JOIN device_categories c ON c.id = d.category_id
         WHERE d.user_id = $1
         ORDER BY d.created_at DESC`,
                  [userId]
              )
            : support.hasCategoriesTable && support.hasDeviceCategoryMapTable
              ? await pool.query(
                    `SELECT d.id, d.user_id, d.device_code, d.device_name,
                m.category_id, c.name AS category_name,
                CASE
                  WHEN d.last_seen_at IS NOT NULL
                       AND d.last_seen_at > NOW() - INTERVAL '${ONLINE_THRESHOLD_SEC} seconds'
                  THEN 'online'
                  ELSE 'offline'
                END AS status,
                d.install_location, d.firmware_version, d.last_seen_at, d.created_at, d.updated_at
         FROM devices d
         LEFT JOIN device_category_map m ON m.device_id = d.id
         LEFT JOIN device_categories c ON c.id = m.category_id
         WHERE d.user_id = $1
         ORDER BY d.created_at DESC`,
                    [userId]
                )
              : await pool.query(
                    `SELECT d.id, d.user_id, d.device_code, d.device_name,
                NULL::BIGINT AS category_id,
                NULL::VARCHAR AS category_name,
                CASE
                  WHEN d.last_seen_at IS NOT NULL
                       AND d.last_seen_at > NOW() - INTERVAL '${ONLINE_THRESHOLD_SEC} seconds'
                  THEN 'online'
                  ELSE 'offline'
                END AS status,
                d.install_location, d.firmware_version, d.last_seen_at, d.created_at, d.updated_at
         FROM devices d
         WHERE d.user_id = $1
         ORDER BY d.created_at DESC`,
                    [userId]
                );

    return q.rows;
}

async function getDeviceById(userId, deviceId) {
    const support = await getCategorySupport();
    const q =
        support.hasCategoriesTable && support.hasDeviceCategoryColumn
            ? await pool.query(
                  `SELECT d.id, d.user_id, d.device_code, d.device_name,
                d.category_id, c.name AS category_name,
                CASE
                  WHEN d.last_seen_at IS NOT NULL
                       AND d.last_seen_at > NOW() - INTERVAL '${ONLINE_THRESHOLD_SEC} seconds'
                  THEN 'online'
                  ELSE 'offline'
                END AS status,
                d.install_location, d.firmware_version, d.last_seen_at, d.created_at, d.updated_at
         FROM devices d
         LEFT JOIN device_categories c ON c.id = d.category_id
         WHERE d.id = $1 AND d.user_id = $2
         LIMIT 1`,
                  [deviceId, userId]
              )
            : support.hasCategoriesTable && support.hasDeviceCategoryMapTable
              ? await pool.query(
                    `SELECT d.id, d.user_id, d.device_code, d.device_name,
                m.category_id, c.name AS category_name,
                CASE
                  WHEN d.last_seen_at IS NOT NULL
                       AND d.last_seen_at > NOW() - INTERVAL '${ONLINE_THRESHOLD_SEC} seconds'
                  THEN 'online'
                  ELSE 'offline'
                END AS status,
                d.install_location, d.firmware_version, d.last_seen_at, d.created_at, d.updated_at
         FROM devices d
         LEFT JOIN device_category_map m ON m.device_id = d.id
         LEFT JOIN device_categories c ON c.id = m.category_id
         WHERE d.id = $1 AND d.user_id = $2
         LIMIT 1`,
                    [deviceId, userId]
                )
              : await pool.query(
                    `SELECT d.id, d.user_id, d.device_code, d.device_name,
                NULL::BIGINT AS category_id,
                NULL::VARCHAR AS category_name,
                CASE
                  WHEN d.last_seen_at IS NOT NULL
                       AND d.last_seen_at > NOW() - INTERVAL '${ONLINE_THRESHOLD_SEC} seconds'
                  THEN 'online'
                  ELSE 'offline'
                END AS status,
                d.install_location, d.firmware_version, d.last_seen_at, d.created_at, d.updated_at
         FROM devices d
         WHERE d.id = $1 AND d.user_id = $2
         LIMIT 1`,
                    [deviceId, userId]
                );

    if (q.rowCount === 0) {
        throw new Error("DEVICE_NOT_FOUND");
    }

    return q.rows[0];
}

async function updateDeviceById(userId, deviceId, payload) {
    const support = await getCategorySupport();
    await getDeviceById(userId, deviceId);

    if (payload.category_id !== undefined && !support.hasDeviceCategoryColumn && !support.hasDeviceCategoryMapTable) {
        throw new Error("CATEGORY_SCHEMA_NOT_READY");
    }

    if (payload.category_id !== undefined) {
        await ensureCategoryOwnership(userId, payload.category_id);
    }

    const assignments = [];
    const values = [];

    if (payload.device_name !== undefined) {
        values.push(payload.device_name.trim());
        assignments.push(`device_name = $${values.length}`);
    }
    if (payload.category_id !== undefined && support.hasDeviceCategoryColumn) {
        values.push(payload.category_id);
        assignments.push(`category_id = $${values.length}`);
    }
    if (payload.install_location !== undefined) {
        values.push(payload.install_location);
        assignments.push(`install_location = $${values.length}`);
    }
    if (payload.firmware_version !== undefined) {
        values.push(payload.firmware_version);
        assignments.push(`firmware_version = $${values.length}`);
    }

    if (assignments.length === 0) {
        return getDeviceById(userId, deviceId);
    }

    values.push(deviceId, userId);

    await pool.query(
        `UPDATE devices
     SET ${assignments.join(", ")}, updated_at = NOW()
     WHERE id = $${values.length - 1} AND user_id = $${values.length}
     RETURNING id`,
        values
    );

    if (!support.hasDeviceCategoryColumn && support.hasDeviceCategoryMapTable && payload.category_id !== undefined) {
        if (payload.category_id === null) {
            await pool.query(`DELETE FROM device_category_map WHERE device_id = $1`, [deviceId]);
        } else {
            await pool.query(
                `INSERT INTO device_category_map (device_id, category_id)
         VALUES ($1, $2)
         ON CONFLICT (device_id)
         DO UPDATE SET category_id = EXCLUDED.category_id, updated_at = NOW()`,
                [deviceId, payload.category_id]
            );
        }
    }

    return getDeviceById(userId, deviceId);
}

async function deleteDeviceById(userId, deviceId) {
    const q = await pool.query(
        `DELETE FROM devices
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
        [deviceId, userId]
    );

    if (q.rowCount === 0) {
        throw new Error("DEVICE_NOT_FOUND");
    }

    return { id: q.rows[0].id };
}

module.exports = {
    createDevice,
    listDevices,
    getDeviceById,
    updateDeviceById,
    deleteDeviceById,
};
