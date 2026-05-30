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
      `SELECT id, full_name, email, role, created_at
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [payload.sub]
    );

    if (userQ.rowCount === 0) {
      return fail(res, "Unauthorized", 401, "UNAUTHORIZED");
    }

    req.user = userQ.rows[0];
    return next();
  } catch (err) {
    return fail(res, "Unauthorized", 401, "UNAUTHORIZED");
  }
}

module.exports = {
  requireAuth,
};
