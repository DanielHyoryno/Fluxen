const bcrypt = require("bcrypt");
const pool = require("../config/db");
const { fail } = require("../utils/response");

async function requireDeviceToken(req, res, next) {
    try {
        const authHeader = req.headers.authorization || "";
        const [scheme, token] = authHeader.split(" ");

        if (scheme !== "Bearer" || !token) {
            return fail(res, "Unauthorized device", 401, "UNAUTHORIZED_DEVICE");
        }

        const deviceCode = req.body?.device_code;
        if (!deviceCode) {
            return fail(res, "device_code is required", 422, "VALIDATION_ERROR");
        }

        const deviceQ = await pool.query(
            `SELECT id, user_id, device_code, api_token_hash, status, last_seen_at
       FROM devices
       WHERE device_code = $1
       LIMIT 1`,
            [deviceCode]
        );

        if (deviceQ.rowCount === 0) {
            return fail(res, "Unauthorized device", 401, "UNAUTHORIZED_DEVICE");
        }

        const device = deviceQ.rows[0];
        const matched = await bcrypt.compare(token, device.api_token_hash);

        if (!matched) {
            return fail(res, "Unauthorized device", 401, "UNAUTHORIZED_DEVICE");
        }

        req.device = {
            id: device.id,
            user_id: device.user_id,
            device_code: device.device_code,
            status: device.status,
            last_seen_at: device.last_seen_at,
        };

        return next();
    } catch (err) {
        console.error("requireDeviceToken error:", err);
        return fail(res, "Unauthorized device", 401, "UNAUTHORIZED_DEVICE");
    }
}

module.exports = {
    requireDeviceToken,
};
