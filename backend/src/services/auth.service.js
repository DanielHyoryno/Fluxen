const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../config/db");
const env = require("../config/env");

const SALT_ROUNDS = 10;
const ACCESS_TOKEN_EXPIRES_IN = env.auth.jwtExpiresIn;

function getJwtSecret() {
    if (!env.auth.jwtSecret) {
        throw new Error("JWT_SECRET_NOT_SET");
    }
    return env.auth.jwtSecret;
}

function signAccessToken(user) {
    return jwt.sign(
        {
            sub: String(user.id),
            email: user.email,
            role: user.role,
        },
        getJwtSecret(),
        { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
    );
}

function sanitizeUser(user) {
    return {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        created_at: user.created_at,
    };
}

async function register(payload) {
    const email = payload.email.trim().toLowerCase();

    const existingQ = await pool.query(`SELECT id FROM users WHERE email = $1 LIMIT 1`, [email]);

    if (existingQ.rowCount > 0) {
        throw new Error("EMAIL_ALREADY_USED");
    }

    const passwordHash = await bcrypt.hash(payload.password, SALT_ROUNDS);

    const createQ = await pool.query(
        `INSERT INTO users (full_name, email, password_hash)
     VALUES ($1, $2, $3)
     RETURNING id, full_name, email, role, created_at`,
        [payload.full_name.trim(), email, passwordHash]
    );

    const user = createQ.rows[0];
    const accessToken = signAccessToken(user);

    return {
        user: sanitizeUser(user),
        access_token: accessToken,
        token_type: "Bearer",
    };
}

async function login(payload) {
    const email = payload.email.trim().toLowerCase();

    const userQ = await pool.query(
        `SELECT id, full_name, email, role, password_hash, created_at
     FROM users
     WHERE email = $1
     LIMIT 1`,
        [email]
    );

    if (userQ.rowCount === 0) {
        throw new Error("INVALID_CREDENTIALS");
    }

    const user = userQ.rows[0];
    const matched = await bcrypt.compare(payload.password, user.password_hash);
    if (!matched) {
        throw new Error("INVALID_CREDENTIALS");
    }

    const accessToken = signAccessToken(user);

    return {
        user: sanitizeUser(user),
        access_token: accessToken,
        token_type: "Bearer",
    };
}

module.exports = {
    register,
    login,
    getJwtSecret,
};
