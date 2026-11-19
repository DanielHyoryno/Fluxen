const { createHmac, randomBytes, randomInt } = require("node:crypto");
const bcrypt = require("bcrypt");
const pool = require("../config/db");
const { reportEmail: settings } = require("../config/env");
const { reportEmailError, sendWithResend } = require("./report-email.service");

const emailKey = (email) => email.trim().toLowerCase();
const invalidCode = () => reportEmailError(422, "ACCOUNT_EMAIL_CODE_INVALID", "Invalid or expired code");

function requireAvailable() {
    if (!settings.accountEnabled || settings.otpSecret.length < 32 || !settings.apiKey || !settings.from) {
        throw reportEmailError(503, "ACCOUNT_EMAIL_UNAVAILABLE", "Account email is not configured");
    }
}

function digest(scope, ...fields) {
    return createHmac("sha256", settings.otpSecret).update(JSON.stringify([scope, ...fields])).digest("hex");
}

async function transaction(action) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const result = await action(client);
        await client.query("COMMIT");
        return result;
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally { client.release(); }
}

async function issueCode(email, purpose, locale) {
    const code = String(randomInt(1000000)).padStart(6, "0");
    const { rowCount } = await pool.query(
        `INSERT INTO account_email_challenges (email, purpose, code_digest, expires_at)
         VALUES ($1, $2, $3, NOW() + INTERVAL '10 minutes')
         ON CONFLICT (email, purpose) DO UPDATE SET code_digest = EXCLUDED.code_digest, requested_at = NOW(),
           expires_at = EXCLUDED.expires_at, attempts = 0, reset_token_digest = NULL, reset_expires_at = NULL
         WHERE account_email_challenges.requested_at <= NOW() - INTERVAL '60 seconds'
         RETURNING email`,
        [email, purpose, digest(purpose, email, code)]
    );
    if (!rowCount) throw reportEmailError(429, "REPORT_EMAIL_CODE_COOLDOWN", "Wait before requesting another code");
    const reset = purpose === "reset";
    await sendWithResend({
        to: email,
        subject: locale === "id" ? (reset ? "Atur ulang kata sandi Fluxen" : "Verifikasi pendaftaran Fluxen")
            : (reset ? "Reset your Fluxen password" : "Verify your Fluxen registration"),
        text: locale === "id" ? `Kode Fluxen: ${code}. Berlaku 10 menit. Abaikan jika Anda tidak memintanya.`
            : `Fluxen code: ${code}. It expires in 10 minutes. Ignore this message if you did not request it.`,
    });
}

async function consumeCode(client, email, purpose, code, resetToken = null) {
    const { rows } = await client.query(
        `WITH candidate AS (
            SELECT email, purpose, code_digest = $3 AS matched FROM account_email_challenges
             WHERE email = $1 AND purpose = $2 AND expires_at > NOW() AND code_digest IS NOT NULL AND attempts < 5
             FOR UPDATE
         )
         UPDATE account_email_challenges a SET
            attempts = a.attempts + 1,
            code_digest = CASE WHEN c.matched OR a.attempts + 1 >= 5 THEN NULL ELSE a.code_digest END,
            reset_token_digest = CASE WHEN c.matched THEN $4::text ELSE NULL END,
            reset_expires_at = CASE WHEN c.matched AND $4::text IS NOT NULL THEN NOW() + INTERVAL '10 minutes' ELSE NULL END
         FROM candidate c WHERE a.email = c.email AND a.purpose = c.purpose RETURNING c.matched`,
        [email, purpose, digest(purpose, email, code), resetToken ? digest("reset-token", resetToken) : null]
    );
    return Boolean(rows[0]?.matched);
}

async function requestRegistration({ email, locale }) {
    requireAvailable();
    email = emailKey(email);
    if ((await pool.query("SELECT 1 FROM users WHERE email = $1", [email])).rowCount) throw new Error("EMAIL_ALREADY_USED");
    await issueCode(email, "register", locale);
    return { email, verification_required: true };
}

async function confirmRegistration({ full_name, email, password, code }) {
    requireAvailable();
    email = emailKey(email);
    const user = await transaction(async (client) => {
        if (!await consumeCode(client, email, "register", code)) return null;
        const hash = await bcrypt.hash(password, 10);
        const result = await client.query(
            `INSERT INTO users (full_name, email, password_hash) VALUES ($1, $2, $3)
             ON CONFLICT (email) DO NOTHING RETURNING id, full_name, email, role, created_at`, [full_name.trim(), email, hash]
        );
        const registered = result.rows[0];
        if (!registered) throw new Error("EMAIL_ALREADY_USED");
        await client.query("INSERT INTO report_email_verifications (user_id, email, verified_at) VALUES ($1, $2, NOW())", [registered.id, email]);
        return registered;
    });
    if (!user) throw invalidCode();
    return { user };
}

async function requestReset({ email, locale }) {
    requireAvailable();
    email = emailKey(email);
    const { rowCount } = await pool.query(
        `SELECT 1 FROM users u JOIN report_email_verifications v ON v.user_id = u.id AND v.email = u.email
         WHERE u.email = $1 AND v.verified_at IS NOT NULL`, [email]
    );
    if (rowCount) {
        try { await issueCode(email, "reset", locale); }
        catch (error) {
            if (!error.reportEmailError) throw error;
            // Keep the public reset response identical for registered and unknown addresses.
            if (error.status >= 500) console.warn("Reset email was not accepted by provider");
        }
    }
    return { accepted: true };
}

async function verifyReset({ email, code }) {
    requireAvailable();
    const resetToken = randomBytes(32).toString("hex");
    const valid = await transaction(client => consumeCode(client, emailKey(email), "reset", code, resetToken));
    if (!valid) throw invalidCode();
    return { reset_token: resetToken };
}

async function resetPassword({ reset_token, password }) {
    requireAvailable();
    const updated = await transaction(async (client) => {
        const { rows } = await client.query(
            `UPDATE account_email_challenges SET reset_token_digest = NULL, reset_expires_at = NULL
             WHERE purpose = 'reset' AND reset_token_digest = $1 AND reset_expires_at > NOW() RETURNING email`,
            [digest("reset-token", reset_token)]
        );
        if (!rows[0]) return false;
        const hash = await bcrypt.hash(password, 10);
        const result = await client.query(
            `UPDATE users u SET password_hash = $2, session_version = session_version + 1,
               push_subscription = NULL, updated_at = NOW()
             WHERE u.email = $1 AND EXISTS (SELECT 1 FROM report_email_verifications v
               WHERE v.user_id = u.id AND v.email = u.email AND v.verified_at IS NOT NULL)`, [rows[0].email, hash]
        );
        return result.rowCount > 0;
    });
    if (!updated) throw reportEmailError(422, "ACCOUNT_RESET_EXPIRED", "Reset session expired or used");
    return { password_reset: true };
}

module.exports = { requestRegistration, confirmRegistration, requestReset, verifyReset, resetPassword };
