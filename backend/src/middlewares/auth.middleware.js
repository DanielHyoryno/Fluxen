const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const { getJwtSecret } = require("../services/auth.service");
const { fail } = require("../utils/response");

async function requireAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization || "";
        const [scheme, token] = authHeader.split(" ");

        if (scheme !== "Bearer" || !token) {
            return fail(res, "Unauthorized", 401, "UNAUTHORIZED");
        }

        const payload = jwt.verify(token, getJwtSecret());

        const userQ = await pool.query(
            `SELECT u.id, u.full_name, u.email, u.role, u.created_at,
              COALESCE((to_jsonb(u)->>'session_version')::integer, 0) AS session_version
       FROM users u
       WHERE id = $1
       LIMIT 1`,
            [payload.sub]
        );

        const { session_version, ...user } = userQ.rows[0] || {};
        if (userQ.rowCount === 0 || Number(payload.sv ?? 0) !== Number(session_version ?? 0)) {
            return fail(res, "Unauthorized", 401, "UNAUTHORIZED");
        }

        req.user = user;
        req.auth = { expiresAt: payload.exp };
        return next();
    } catch (err) {
        if (["JsonWebTokenError", "TokenExpiredError", "NotBeforeError"].includes(err.name)) {
            return fail(res, "Unauthorized", 401, "UNAUTHORIZED");
        }
        // A DB outage is not proof of an invalid/expired session. In particular,
        // push logout must retry instead of treating a failed revocation as success.
        return fail(res, "Service temporarily unavailable", 503, "AUTH_UNAVAILABLE");
    }
}

module.exports = {
    requireAuth,
};
